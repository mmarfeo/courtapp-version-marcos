import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Necesitás iniciar sesión para cancelar.' }, { status: 401 });
    }

    const { alquiler_id } = await req.json();
    if (!alquiler_id) {
      return NextResponse.json({ error: 'Se requiere alquiler_id.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Sesión inválida. Iniciá sesión de nuevo.' }, { status: 401 });
    }

    const { data: alquiler, error: fetchError } = await supabase
      .from('alquileres_cancha')
      .select('id, usuario_id, fecha, hora_inicio, estado_pago, cancha:canchas(numero_cancha, deporte)')
      .eq('id', alquiler_id)
      .single();

    if (fetchError || !alquiler) {
      return NextResponse.json({ error: 'Reserva no encontrada.' }, { status: 404 });
    }

    if (alquiler.usuario_id !== user.id) {
      return NextResponse.json({ error: 'No tenés permiso para cancelar esta reserva.' }, { status: 403 });
    }

    if (alquiler.estado_pago === 'Rechazado') {
      return NextResponse.json({ error: 'Esta reserva ya estaba cancelada.' }, { status: 409 });
    }

    const { error: updateError } = await supabase
      .from('alquileres_cancha')
      .update({ estado_pago: 'Rechazado' })
      .eq('id', alquiler_id);

    if (updateError) throw updateError;

    const cancha = alquiler.cancha as any;
    return NextResponse.json({
      success: true,
      mensaje: `Reserva cancelada: Cancha ${cancha?.numero_cancha} (${cancha?.deporte}) el ${alquiler.fecha} a las ${String(alquiler.hora_inicio).substring(0, 5)} hs.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno.' }, { status: 500 });
  }
}
