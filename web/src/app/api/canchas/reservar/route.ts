import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const timeToMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

function addWeeks(dateStr: string, weeks: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().split('T')[0];
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Necesitás iniciar sesión para reservar.' }, { status: 401 });
    }

    const body = await req.json();
    const { cancha_id, fecha, hora_inicio, hora_fin, es_semanal, fecha_fin_recurrencia } = body;

    if (!cancha_id || !fecha || !hora_inicio || !hora_fin) {
      return NextResponse.json({ error: 'Faltan parámetros obligatorios: cancha_id, fecha, hora_inicio, hora_fin.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Sesión inválida. Iniciá sesión de nuevo.' }, { status: 401 });
    }

    const { data: cancha, error: canchaError } = await supabase
      .from('canchas')
      .select('id, numero_cancha, deporte, precio_hora_dia, precio_hora_noche, hora_inicio_noche, precio_profesor_hora_dia, precio_profesor_hora_noche')
      .eq('id', cancha_id)
      .eq('activa', true)
      .single();

    if (canchaError || !cancha) {
      return NextResponse.json({ error: 'Cancha no encontrada o inactiva.' }, { status: 404 });
    }

    const { data: perfil } = await supabase
      .from('perfiles_usuarios')
      .select('roles')
      .eq('id', user.id)
      .single();

    const isProfesor = perfil?.roles?.includes('Profesor') ?? false;

    const isNoche = cancha.hora_inicio_noche
      ? timeToMinutes(hora_inicio) >= timeToMinutes(cancha.hora_inicio_noche)
      : false;

    let precioHora: number;
    if (isProfesor && cancha.precio_profesor_hora_dia != null) {
      precioHora = isNoche
        ? (cancha.precio_profesor_hora_noche ?? cancha.precio_hora_noche)
        : cancha.precio_profesor_hora_dia;
    } else {
      precioHora = isNoche ? cancha.precio_hora_noche : cancha.precio_hora_dia;
    }

    const duracionHoras = (timeToMinutes(hora_fin) - timeToMinutes(hora_inicio)) / 60;
    const monto_total = precioHora * duracionHoras;
    const feeDecimal = parseFloat(process.env.PLATFORM_FEE_PERCENTAGE || '10') / 100;
    const comision_plataforma = monto_total * feeDecimal;
    const monto_neto_club = monto_total - comision_plataforma;

    // Construir lista de fechas a reservar
    const fechas: string[] = [fecha];
    if (es_semanal && fecha_fin_recurrencia) {
      let siguiente = addWeeks(fecha, 1);
      while (siguiente <= fecha_fin_recurrencia) {
        fechas.push(siguiente);
        siguiente = addWeeks(siguiente, 1);
      }
    }

    const filas = fechas.map((f) => ({
      cancha_id,
      usuario_id: user.id,
      fecha: f,
      hora_inicio,
      hora_fin,
      monto_total,
      comision_plataforma,
      monto_neto_club,
      estado_pago: 'Aprobado',
      fecha_pago: new Date().toISOString(),
      es_semanal: es_semanal ?? false,
      fecha_fin_recurrencia: fecha_fin_recurrencia ?? null,
    }));

    const { error: insertError } = await supabase.from('alquileres_cancha').insert(filas);

    if (insertError) {
      // El trigger check_overlapping_booking lanza P0001
      if (insertError.code === 'P0001' || insertError.message?.includes('solapamiento')) {
        return NextResponse.json({ error: 'El horario solapa con una reserva existente.' }, { status: 409 });
      }
      throw insertError;
    }

    const detalle = fechas.length > 1
      ? `Se crearon ${fechas.length} reservas semanales desde ${fecha} hasta ${fechas[fechas.length - 1]}.`
      : `Reserva confirmada para el ${fecha} de ${hora_inicio.substring(0, 5)} a ${hora_fin.substring(0, 5)} hs.`;

    return NextResponse.json({ success: true, mensaje: detalle, fechas });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno.' }, { status: 500 });
  }
}
