import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// 1. GET: Validación / Handshake requerido por Meta / WhatsApp Cloud API
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const localVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'courtup-verify-token';

    if (mode === 'subscribe' && token === localVerifyToken) {
      console.log('Webhook de WhatsApp validado correctamente.');
      // Meta espera el challenge directamente como texto plano en el body
      return new Response(challenge, { status: 200 });
    }

    return new Response('Verificación fallida', { status: 403 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// 2. POST: Recibir mensajes entrantes de Telegram y WhatsApp
export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await request.json();

    let senderId: string | null = null;
    let textContent: string | null = null;
    let channelType: 'telegram' | 'whatsapp' | null = null;

    // A. Identificar si el mensaje proviene de Telegram Bot API
    if (body.message && body.message.chat && body.message.chat.id) {
      const telegramChatId = body.message.chat.id.toString();
      textContent = body.message.text || '';
      channelType = 'telegram';

      // Buscar perfil por telegram_id
      const { data: perfil } = await supabaseAdmin
        .from('perfiles_usuarios')
        .select('id')
        .eq('telegram_id', telegramChatId)
        .maybeSingle();

      if (perfil) {
        senderId = perfil.id;
      } else {
        console.log(`Mensaje ignorado: Telegram chat_id ${telegramChatId} no registrado en CourtUp.`);
      }
    }

    // B. Identificar si el mensaje proviene de WhatsApp Cloud API
    else if (
      body.entry &&
      body.entry[0].changes &&
      body.entry[0].changes[0].value &&
      body.entry[0].changes[0].value.messages &&
      body.entry[0].changes[0].value.messages[0]
    ) {
      const msg = body.entry[0].changes[0].value.messages[0];
      const phone = msg.from; // Número de teléfono del remitente
      textContent = msg.text?.body || '';
      channelType = 'whatsapp';

      // Buscar perfil por telefono
      const { data: perfil } = await supabaseAdmin
        .from('perfiles_usuarios')
        .select('id')
        .eq('telefono', phone)
        .maybeSingle();

      if (perfil) {
        senderId = perfil.id;
      } else {
        console.log(`Mensaje ignorado: Teléfono de WhatsApp ${phone} no registrado en CourtUp.`);
      }
    }

    // Si no logramos identificar el remitente o el texto está vacío, retornamos exitoso para evitar reintentos infinitos
    if (!senderId || !textContent?.trim()) {
      return NextResponse.json({ ok: true, status: 'ignored' });
    }

    // C. Buscar partidos activos del jugador (donde participe y no estén jugados/cancelados)
    const { data: partidos, error: partError } = await supabaseAdmin
      .from('partidos')
      .select('id, estado')
      .or(`p1_jugador_1_id.eq.${senderId},p1_jugador_2_id.eq.${senderId},p2_jugador_1_id.eq.${senderId},p2_jugador_2_id.eq.${senderId}`)
      .order('id', { ascending: false });

    if (partError || !partidos || partidos.length === 0) {
      console.log(`No se encontraron partidos para el usuario ${senderId}.`);
      return NextResponse.json({ ok: true, status: 'no_active_matches' });
    }

    // Filtrar el partido activo más cercano o reciente
    const partidoActivo = partidos.find(
      (p) => p.estado !== 'jugado' && p.estado !== 'cancelado'
    );

    if (!partidoActivo) {
      console.log(`Todos los partidos del usuario ${senderId} ya han finalizado.`);
      return NextResponse.json({ ok: true, status: 'no_pending_matches' });
    }

    // D. Insertar el mensaje en el chat del partido
    const { error: insertError } = await supabaseAdmin
      .from('mensajes_chat')
      .insert([
        {
          partido_id: partidoActivo.id,
          remitente_id: senderId,
          mensaje: textContent.trim()
        }
      ]);

    if (insertError) {
      throw insertError;
    }

    console.log(`Mensaje de ${channelType} ruteado exitosamente al Partido #${partidoActivo.id}.`);
    return NextResponse.json({ ok: true, status: 'delivered', partido_id: partidoActivo.id });

  } catch (err: any) {
    console.error('Error procesando webhook de chat:', err);
    // Respondemos con status 500 para alertar a la plataforma externa (Telegram/WhatsApp reintentarán)
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
