import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_TOOLS, executeToolCall, ToolCall } from '@/lib/supabase-tools';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';
const MAX_TOOL_ITERATIONS = 5;

function buildSystemPrompt(): string {
  const hoy = new Date().toLocaleDateString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const isoHoy = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }))
    .toISOString()
    .split('T')[0];
  const manana = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
  manana.setDate(manana.getDate() + 1);
  const isoManana = manana.toISOString().split('T')[0];

  return `Sos el asistente virtual de CourtUp, una plataforma de reserva de canchas de tenis y pádel en Argentina.
FECHA ACTUAL: ${hoy} (${isoHoy}). Mañana es ${isoManana}. Usá estas fechas cuando el usuario diga "hoy", "mañana", "esta semana", etc.

HERRAMIENTAS DISPONIBLES Y CUÁNDO USARLAS:
- consultar_canchas → cuando pregunten por canchas, precios de cancha, superficies
- consultar_clases → cuando quieran VER qué clases hay disponibles, o necesites el ID para reservar
- consultar_partidos → cuando pregunten por partidos organizados
- consultar_reservas → SOLO para ver alquileres de canchas (no clases)
- consultar_profesores → cuando pregunten por profesores
- consultar_mis_clases → cuando el usuario pregunte por SUS clases ya reservadas o historial personal
- reservar_clase → cuando el usuario quiera INSCRIBIRSE o RESERVAR una clase (primero llamá a consultar_clases para obtener el ID)

REGLAS ESTRICTAS:
- Respondé SOLO lo que se pregunta. Sin sugerencias extra.
- Respuestas cortas y directas. Máximo 2 oraciones.
- Respondé en español argentino.
- Si no hay datos, decilo en una sola oración.
- Para reservar una clase: 1) llamá a consultar_clases para ver disponibilidad y obtener el ID, 2) llamá a reservar_clase con ese ID.
- "Reservar una clase" y "reservar una cancha" son cosas distintas: para clases usá reservar_clase, para canchas decí que no está disponible esa función aún.`;
}

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

function sseEvent(controller: ReadableStreamDefaultController, event: string, data: string) {
  controller.enqueue(
    new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  );
}

// ── Grok path: tool calling agent loop ──────────────────────────────────────

async function runGeminiAgent(
  messages: Message[],
  send: (event: string, data: string) => void,
  controller: ReadableStreamDefaultController,
  userToken?: string
) {
  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GEMINI_API_KEY}`,
      },
      body: JSON.stringify({
        model: GEMINI_MODEL,
        messages,
        tools: SUPABASE_TOOLS,
        tool_choice: 'auto',
        stream: false,
      }),
    });

    if (!res.ok) {
      // On auth/quota errors fall back to Ollama context mode
      if (res.status === 401 || res.status === 402 || res.status === 403 || res.status === 429) {
        const userMessages = messages.filter((m) => m.role !== 'system');
        await runOllamaAgent(
          userMessages.map((m) => ({ role: m.role as string, content: m.content ?? '' })),
          send,
          controller
        );
        return;
      }
      const err = await res.text();
      send('error', `Error del proveedor de IA: ${res.status} - ${err}`);
      controller.close();
      return;
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const assistantMessage: Message = choice?.message;

    if (!assistantMessage) {
      send('error', 'Respuesta vacía del modelo');
      controller.close();
      return;
    }

    messages.push(assistantMessage);

    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      const words = (assistantMessage.content || '').split(' ');
      for (const word of words) {
        send('text', word + ' ');
        await new Promise((r) => setTimeout(r, 10));
      }
      send('done', '');
      controller.close();
      return;
    }

    for (const toolCall of assistantMessage.tool_calls) {
      console.log(`[AI] tool_call: ${toolCall.function.name} args: ${toolCall.function.arguments}`);
      send('tool_start', toolCall.function.name);
      const result = await executeToolCall(toolCall, userToken);
      console.log(`[AI] tool_result: ${toolCall.function.name} => ${result.substring(0, 200)}`);
      send('tool_end', toolCall.function.name);
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        content: result,
      });
    }
  }

  send('text', 'Lo siento, no pude completar la consulta. Por favor intentá de nuevo.');
  send('done', '');
  controller.close();
}

// ── Ollama path: pre-fetch Supabase context + streaming ─────────────────────

async function fetchSupabaseContext(): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || url.includes('placeholder')) return '';

  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const hoy = new Date().toISOString().split('T')[0];

  const [canchas, profesores, clases, reservas] = await Promise.all([
    supabase.from('canchas').select('id, nombre, deporte, superficie, precio_por_hora, activa, numero_cancha').eq('activa', true).order('numero_cancha'),
    supabase.from('perfiles_usuarios').select('nombre, precio_clase_tenis, precio_clase_padel').eq('rol', 'Profesor'),
    supabase.from('clases_disponibles').select('fecha, hora_inicio, hora_fin, cupo_maximo, precio_clase, deporte, categoria_target, profesor:perfiles_usuarios!clases_disponibles_profesor_id_fkey(nombre)').eq('activa', true).gte('fecha', hoy).order('fecha').order('hora_inicio').limit(20),
    supabase.from('alquileres_cancha').select('fecha, hora_inicio, hora_fin, estado_pago, cancha:canchas(nombre, numero_cancha)').eq('fecha', hoy).in('estado_pago', ['Aprobado', 'Pendiente']).order('hora_inicio'),
  ]);

  return `

## DATOS ACTUALES DEL CLUB (fecha hoy: ${hoy}):

### Canchas activas:
${JSON.stringify(canchas.data ?? [], null, 2)}

### Profesores:
${JSON.stringify(profesores.data ?? [], null, 2)}

### Próximas clases disponibles:
${JSON.stringify(clases.data ?? [], null, 2)}

### Reservas de hoy:
${JSON.stringify(reservas.data ?? [], null, 2)}`;
}

async function runOllamaAgent(
  userMessages: { role: string; content: string }[],
  send: (event: string, data: string) => void,
  controller: ReadableStreamDefaultController
) {
  send('tool_start', 'consultar_canchas');
  const context = await fetchSupabaseContext();
  send('tool_end', 'consultar_canchas');

  const systemWithContext = buildSystemPrompt() + context;

  const res = await fetch(`${OLLAMA_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [
        { role: 'system', content: systemWithContext },
        ...userMessages,
      ],
      stream: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    send('error', `Error de Ollama: ${res.status} - ${err}`);
    controller.close();
    return;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));

    for (const line of lines) {
      const raw = line.slice(6).trim();
      if (raw === '[DONE]') continue;
      try {
        const parsed = JSON.parse(raw);
        const token = parsed.choices?.[0]?.delta?.content;
        if (token) send('text', token);
      } catch {
        // skip malformed chunks
      }
    }
  }

  send('done', '');
  controller.close();
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { messages: userMessages, userToken } = await req.json();

    if (!Array.isArray(userMessages) || userMessages.length === 0) {
      return new Response(JSON.stringify({ error: 'Se requieren mensajes' }), { status: 400 });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: string) => sseEvent(controller, event, data);

        try {
          if (GEMINI_API_KEY) {
            const messages: Message[] = [
              { role: 'system', content: buildSystemPrompt() },
              ...userMessages.map((m: { role: string; content: string }) => ({
                role: m.role as 'user' | 'assistant',
                content: m.content,
              })),
            ];
            await runGeminiAgent(messages, send, controller, userToken);
          } else {
            await runOllamaAgent(userMessages, send, controller);
          }
        } catch (err) {
          send('error', `Error interno: ${String(err)}`);
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}
