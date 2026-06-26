import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// Helpers para cálculo de tiempo
const timeToMinutes = (timeStr: string) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

const minutesToTime = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { cancha_id, fecha, hora_inicio, duracion_minutos, usuario_id, success_url, webhook_url, es_semanal } = body;

    if (!cancha_id || !fecha || !hora_inicio || !duracion_minutos || !usuario_id) {
      return NextResponse.json({ error: 'Faltan parámetros obligatorios' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Validar la cancha y obtener precios reales
    const { data: cancha, error: canchaError } = await supabaseAdmin
      .from('canchas')
      .select(`
        *,
        organizaciones (
          nombre,
          mp_access_token
        )
      `)
      .eq('id', cancha_id)
      .single();

    if (canchaError || !cancha) {
      console.error('Error fetching cancha:', canchaError);
      return NextResponse.json({ error: 'Cancha no encontrada' }, { status: 404 });
    }

    // Fetch user role to determine if Professor pricing applies
    const { data: userProfile } = await supabaseAdmin
      .from('perfiles_usuarios')
      .select('roles')
      .eq('id', usuario_id)
      .single();

    const isProfesor = userProfile?.roles?.includes('Profesor') || false;

    // 2. Calcular Precio Real de Forma Segura
    const isNightTime = (startTime: string, nightStart: string) => {
      if (!nightStart) return false;
      const startMins = timeToMinutes(startTime);
      const nightMins = timeToMinutes(nightStart);
      return startMins >= nightMins;
    };

    const isNight = isNightTime(hora_inicio, cancha.hora_inicio_noche);
    
    let hourlyRate = 0;
    if (isProfesor) {
      hourlyRate = isNight 
        ? (cancha.precio_profesor_hora_noche !== null ? cancha.precio_profesor_hora_noche : cancha.precio_hora_noche)
        : (cancha.precio_profesor_hora_dia !== null ? cancha.precio_profesor_hora_dia : cancha.precio_hora_dia);
    } else {
      hourlyRate = isNight ? cancha.precio_hora_noche : cancha.precio_hora_dia;
    }

    const monto_total = (hourlyRate / 60) * duracion_minutos;

    // 3. Calcular Comisiones
    const platformFeePercentage = parseFloat(process.env.PLATFORM_FEE_PERCENTAGE || '10');
    const feeDecimal = platformFeePercentage / 100;
    
    const comision_plataforma = monto_total * feeDecimal;
    const monto_neto_club = monto_total - comision_plataforma;

    // 4. Crear Reserva de Alquiler en Supabase
    const hora_inicio_mins = timeToMinutes(hora_inicio);
    const hora_fin_mins = hora_inicio_mins + duracion_minutos;
    const hora_fin = minutesToTime(hora_fin_mins);

    const { data: alquilerInsertado, error: insertError } = await supabaseAdmin
      .from('alquileres_cancha')
      .insert([{
        cancha_id,
        usuario_id,
        fecha,
        hora_inicio,
        hora_fin,
        monto_total,
        comision_plataforma,
        monto_neto_club,
        estado_pago: 'Pendiente',
        es_semanal: es_semanal || false
      }])
      .select()
      .single();

    if (insertError || !alquilerInsertado) {
      console.error('Error creando reserva:', insertError);
      return NextResponse.json({ error: 'Error al procesar la reserva en la base de datos' }, { status: 500 });
    }

    // 5. Configurar Mercado Pago
    const org = cancha.organizaciones;
    const accessToken = org?.mp_access_token;

    if (!accessToken) {
      return NextResponse.json({ error: 'El club no tiene configurado Mercado Pago' }, { status: 400 });
    }

    const client = new MercadoPagoConfig({ accessToken, options: { timeout: 5000 } });
    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: [
          {
            id: String(alquilerInsertado.id),
            title: `Alquiler Cancha ${cancha.numero_cancha} - ${cancha.deporte}`,
            quantity: 1,
            unit_price: Number(monto_total),
            currency_id: 'ARS',
          }
        ],
        back_urls: {
          success: success_url || 'https://courtup.com/jugador/dashboard',
          failure: success_url || 'https://courtup.com/jugador/dashboard',
          pending: success_url || 'https://courtup.com/jugador/dashboard',
        },
        auto_return: 'approved',
        notification_url: webhook_url || 'https://courtup-web.vercel.app/api/webhooks/mercadopago',
        external_reference: `ALQ_${alquilerInsertado.id}`,
      }
    });

    return NextResponse.json({ 
      init_point: result.init_point, 
      alquiler_id: alquilerInsertado.id, 
      monto_total 
    });

  } catch (error: any) {
    console.error('Error creando pago/reserva:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

