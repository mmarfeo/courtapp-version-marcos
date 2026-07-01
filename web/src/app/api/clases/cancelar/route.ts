import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Necesitás iniciar sesión para cancelar.' }, { status: 401 });
    }

    const { reserva_clase_id } = await req.json();
    if (!reserva_clase_id) {
      return NextResponse.json({ error: 'Se requiere reserva_clase_id.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Sesión inválida. Iniciá sesión de nuevo.' }, { status: 401 });
    }

    const { data: reserva, error: fetchError } = await supabase
      .from('reservas_clases')
      .select('id, alumno_id, estado_pago, clase:clases_disponibles(fecha, hora_inicio, deporte)')
      .eq('id', reserva_clase_id)
      .single();

    if (fetchError || !reserva) {
      return NextResponse.json({ error: 'Reserva no encontrada.' }, { status: 404 });
    }

    if (reserva.alumno_id !== user.id) {
      return NextResponse.json({ error: 'No tenés permiso para cancelar esta reserva.' }, { status: 403 });
    }

    if (reserva.estado_pago === 'Rechazado') {
      return NextResponse.json({ error: 'Esta reserva ya estaba cancelada.' }, { status: 409 });
    }

    const { error: updateError } = await supabase
      .from('reservas_clases')
      .update({ estado_pago: 'Rechazado' })
      .eq('id', reserva_clase_id);

    if (updateError) throw updateError;

    const clase = reserva.clase as any;
    return NextResponse.json({
      success: true,
      mensaje: `Reserva de clase cancelada: ${clase?.deporte} el ${clase?.fecha} a las ${String(clase?.hora_inicio).substring(0, 5)} hs.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno.' }, { status: 500 });
  }
}
