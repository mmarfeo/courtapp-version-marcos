import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { TOOLS_JUGADOR, TOOLS_PROFESOR, TOOLS_ORGANIZADOR, TOOLS_SUPERADMIN, executeToolCall, ToolCall } from '@/lib/supabase-tools';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';
const MAX_TOOL_ITERATIONS = 5;

type Rol = 'Jugador' | 'Profesor' | 'Organizador' | 'SuperAdmin';

function getToolsForRol(rol: Rol) {
  if (rol === 'SuperAdmin') return TOOLS_SUPERADMIN;
  if (rol === 'Organizador') return TOOLS_ORGANIZADOR;
  if (rol === 'Profesor') return TOOLS_PROFESOR;
  return TOOLS_JUGADOR;
}

function buildSystemPrompt(rol: Rol = 'Jugador'): string {
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

  const base = `Sos el asistente virtual de CourtUp, una plataforma de gestión de clubes de tenis y pádel en Argentina.
FECHA ACTUAL: ${hoy} (${isoHoy}). Mañana es ${isoManana}. Usá estas fechas cuando el usuario diga "hoy", "mañana", "esta semana", etc.

REGLAS ESTRICTAS E INVIOLABLES:
1. LIMITACIÓN DE CONTENIDO: Respondé ÚNICAMENTE sobre temas del proyecto (alquier de canchas, torneos, clases, reservas y profesores). Está TERMINANTEMENTE PROHIBIDO responder cualquier otra cosa, incluyendo contar chistes, escribir poemas, hacer humor, filosofar o mantener conversaciones casuales ajenas a la aplicación. Si el usuario te pide un chiste o hablar de otro tema, respondé cortésmente diciendo que solo podés asistir con consultas de la plataforma CourtUp.
2. INCLUSIÓN DE CLUBES OBLIGATORIA: Cada vez que menciones una cancha, una clase, un alquiler, un partido o un torneo, debés especificar OBLIGATORIAMENTE el club al que pertenece (por ejemplo: "Cancha 1 (Tenis) de Club CourtUp" o "Abierto de Padel en Club San Martín"). Está prohibido nombrar canchas, alquileres, clases o torneos sin aclarar su respectivo club.
3. Respuestas cortas y directas en español argentino. Máximo 2-3 oraciones.
4. Si no hay datos, decilo en una sola oración.
5. SIEMPRE pedí confirmación explícita antes de ejecutar acciones de creación, reserva o cancelación.`;

  const prompts: Record<Rol, string> = {
    Jugador: `${base}

ROL ACTUAL: Jugador
HERRAMIENTAS Y CUÁNDO USARLAS:
- buscar_canchas_disponibles → antes de reservar una cancha, para saber cuáles están libres
- crear_reserva_cancha → cuando el usuario quiera reservar una cancha (pedir confirmación primero)
- cancelar_reserva_cancha → para cancelar un alquiler (pedir confirmación explícita)
- listar_mis_reservas_cancha → para ver las reservas de canchas del usuario
- consultar_clases → para ver clases disponibles
- reservar_clase → para inscribirse a una clase (primero consultar_clases para el ID)
- cancelar_reserva_clase → para cancelar una clase reservada (pedir confirmación)
- consultar_mis_clases → para ver las clases que el usuario ya tiene reservadas
- buscar_torneos → para ver torneos disponibles
- inscribir_torneo → para anotarse en un torneo (pedir confirmación)
- cancelar_inscripcion_torneo → para cancelar inscripción (pedir confirmación)
- ver_mis_partidos → para ver los partidos del usuario en torneos
- consultar_profesores → para ver profesores disponibles
- consultar_canchas → para ver información general de canchas y precios`,

    Profesor: `${base}

ROL ACTUAL: Profesor
HERRAMIENTAS Y CUÁNDO USARLAS:
- buscar_canchas_disponibles → antes de crear una clase o reservar cancha
- crear_clase → para crear una nueva clase (pedir confirmación primero)
- editar_clase → para modificar precio, cupo, horario o categoría de una clase propia
- listar_mis_clases_como_profesor → para ver las clases propias del profesor
- ver_alumnos_clase → para ver quiénes están inscriptos en una clase
- cancelar_clase → para cancelar una clase (pedir confirmación, notifica a alumnos)
- crear_reserva_cancha → para reservar una cancha propia (pedir confirmación)
- cancelar_reserva_cancha → para cancelar una reserva de cancha propia (pedir confirmación)
- ver_mis_alquileres_como_profesor → para ver las canchas reservadas por el profesor
- ver_mis_ingresos → para ver el resumen de ingresos del mes (clases + alquileres cobrados)
- ver_mi_deuda → para ver los alquileres aprobados pendientes de pago con el club
- consultar_canchas → para ver canchas y precios
- consultar_profesores → para ver otros profesores`,

    Organizador: `${base}

ROL ACTUAL: Organizador
HERRAMIENTAS Y CUÁNDO USARLAS:
- listar_todos_los_torneos → para ver todos los torneos con cantidad de inscriptos
- listar_inscripciones_torneo → para ver quién se inscribió en un torneo específico
- crear_torneo → para crear un nuevo torneo (pedir confirmación primero)
- cambiar_fase_torneo → para avanzar el torneo de fase (Inscripcion→Zonas→Cuartos→Semifinal→Final→Terminado)
- listar_partidos_torneo → para ver los partidos de un torneo con jugadores y estado
- asignar_partido → para asignar fecha, hora y cancha a un partido
- registrar_resultado → para cargar el resultado de un partido jugado
- consultar_disponibilidad_cancha → para ver el calendario de ocupación de una cancha
- listar_todos_alquileres → para ver todos los alquileres del club
- listar_profesores_y_deudas → para ver el estado de deudas de los profesores
- ver_pagos_pendientes → para ver pagos sin confirmar (alquileres, clases, torneos)
- crear_cancha → para dar de alta una nueva cancha (pedir confirmación)
- editar_cancha → para modificar precios, superficie o estado de una cancha
- cancelar_reserva_organizador → para cancelar cualquier reserva del club (pedir confirmación)
- cancelar_clase_organizador → para cancelar cualquier clase del club (pedir confirmación)
- consultar_clases → para ver todas las clases del club
- consultar_canchas → para ver canchas y precios
- consultar_profesores → para ver profesores`,

    SuperAdmin: `${base}

ROL ACTUAL: SuperAdmin (acceso total a la plataforma)
HERRAMIENTAS Y CUÁNDO USARLAS:
- ver_estadisticas_sistema → para ver métricas globales: clubs, usuarios, torneos, partidos e ingresos del mes
- ver_deudas_profesores → para ver todos los profesores con deuda pendiente por alquileres
- listar_clubs → para listar todos los clubs/organizaciones registrados
- listar_staff_club → para ver el staff de un club específico (requiere organizacion_id) o todos
- [+ todas las herramientas de Organizador disponibles]`,
  };

  return prompts[rol] ?? prompts['Jugador'];
}

async function getRolFromToken(token: string): Promise<Rol> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!url || !key || url.includes('placeholder')) return 'Jugador';

    const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return 'Jugador';

    const { data: perfil } = await supabase
      .from('perfiles_usuarios')
      .select('rol')
      .eq('id', user.id)
      .single();

    return (perfil?.rol as Rol) ?? 'Jugador';
  } catch {
    return 'Jugador';
  }
}

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

function sseEvent(controller: ReadableStreamDefaultController, event: string, data: string) {
  controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
}

async function runGeminiAgent(
  messages: Message[],
  tools: typeof TOOLS_JUGADOR,
  send: (event: string, data: string) => void,
  controller: ReadableStreamDefaultController,
  userToken?: string
) {
  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GEMINI_API_KEY}` },
      body: JSON.stringify({ model: GEMINI_MODEL, messages, tools, tool_choice: 'auto', stream: false }),
    });

    if (!res.ok) {
      if ([401, 402, 403, 429].includes(res.status)) {
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
      messages.push({ role: 'tool', tool_call_id: toolCall.id, name: toolCall.function.name, content: result });
    }
  }

  send('text', 'Lo siento, no pude completar la consulta. Por favor intentá de nuevo.');
  send('done', '');
  controller.close();
}

async function fetchSupabaseContext(): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || url.includes('placeholder')) return '';

  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const hoy = new Date().toISOString().split('T')[0];

  const [canchas, profesores, clases, reservas] = await Promise.all([
    supabase.from('canchas').select('id, numero_cancha, deporte, superficie, precio_hora_dia, precio_hora_noche, activa, nombre_club, organizaciones(nombre)').eq('activa', true).order('numero_cancha'),
    supabase.from('perfiles_usuarios').select('nombre, precio_clase_tenis, precio_clase_padel').eq('rol', 'Profesor'),
    supabase.from('clases_disponibles').select('fecha, hora_inicio, hora_fin, cupo_maximo, precio_clase, deporte, categoria_target, profesor:perfiles_usuarios!clases_disponibles_profesor_id_fkey(nombre), organizaciones(nombre)').eq('activa', true).gte('fecha', hoy).order('fecha').order('hora_inicio').limit(20),
    supabase.from('alquileres_cancha').select('fecha, hora_inicio, hora_fin, estado_pago, cancha:canchas(nombre_club, numero_cancha, organizaciones(nombre))').eq('fecha', hoy).in('estado_pago', ['Aprobado', 'Pendiente']).order('hora_inicio'),
  ]);

  return `\n\n## DATOS ACTUALES DEL CLUB (fecha hoy: ${hoy}):\n\n### Canchas activas:\n${JSON.stringify(canchas.data ?? [], null, 2)}\n\n### Profesores:\n${JSON.stringify(profesores.data ?? [], null, 2)}\n\n### Próximas clases:\n${JSON.stringify(clases.data ?? [], null, 2)}\n\n### Reservas de hoy:\n${JSON.stringify(reservas.data ?? [], null, 2)}`;
}

async function runOllamaAgent(
  userMessages: { role: string; content: string }[],
  send: (event: string, data: string) => void,
  controller: ReadableStreamDefaultController
) {
  send('tool_start', 'consultar_canchas');
  const context = await fetchSupabaseContext();
  send('tool_end', 'consultar_canchas');

  const res = await fetch(`${OLLAMA_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [{ role: 'system', content: buildSystemPrompt('Jugador') + context }, ...userMessages],
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
    for (const line of chunk.split('\n').filter((l) => l.startsWith('data: '))) {
      const raw = line.slice(6).trim();
      if (raw === '[DONE]') continue;
      try {
        const token = JSON.parse(raw).choices?.[0]?.delta?.content;
        if (token) send('text', token);
      } catch { /* skip malformed chunks */ }
    }
  }

  send('done', '');
  controller.close();
}

async function runGeminiAgentSync(
  messages: Message[],
  tools: typeof TOOLS_JUGADOR,
  userToken?: string
): Promise<string> {
  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GEMINI_API_KEY}` },
      body: JSON.stringify({ model: GEMINI_MODEL, messages, tools, tool_choice: 'auto', stream: false }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Error de Gemini: ${res.status} - ${err}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const assistantMessage: Message = choice?.message;

    if (!assistantMessage) throw new Error('Respuesta vacía del modelo');

    messages.push(assistantMessage);

    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      return assistantMessage.content || '';
    }

    for (const toolCall of assistantMessage.tool_calls) {
      console.log(`[AI Sync] tool_call: ${toolCall.function.name} args: ${toolCall.function.arguments}`);
      const result = await executeToolCall(toolCall, userToken);
      console.log(`[AI Sync] tool_result: ${toolCall.function.name} => ${result.substring(0, 200)}`);
      messages.push({ role: 'tool', tool_call_id: toolCall.id, name: toolCall.function.name, content: result });
    }
  }
  return 'Lo siento, no pude completar la consulta. Por favor intentá de nuevo.';
}

export async function POST(req: NextRequest) {
  try {
    const { messages: userMessages, userToken, stream: useStream = true } = await req.json();

    if (!Array.isArray(userMessages) || userMessages.length === 0) {
      return new Response(JSON.stringify({ error: 'Se requieren mensajes' }), { status: 400 });
    }

    if (!useStream) {
      const rol = userToken ? await getRolFromToken(userToken) : 'Jugador';
      const tools = getToolsForRol(rol);
      const systemPrompt = buildSystemPrompt(rol);

      if (GEMINI_API_KEY) {
        const messages: Message[] = [
          { role: 'system', content: systemPrompt },
          ...userMessages.map((m: { role: string; content: string }) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
        ];
        const text = await runGeminiAgentSync(messages, tools, userToken);
        return new Response(JSON.stringify({ text }), { headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ error: 'No Gemini API Key' }), { status: 400 });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: string) => sseEvent(controller, event, data);

        try {
          const rol = userToken ? await getRolFromToken(userToken) : 'Jugador';
          const tools = getToolsForRol(rol);
          const systemPrompt = buildSystemPrompt(rol);

          if (GEMINI_API_KEY) {
            const messages: Message[] = [
              { role: 'system', content: systemPrompt },
              ...userMessages.map((m: { role: string; content: string }) => ({
                role: m.role as 'user' | 'assistant',
                content: m.content,
              })),
            ];
            await runGeminiAgent(messages, tools, send, controller, userToken);
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
