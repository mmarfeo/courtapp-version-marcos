import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Necesitás iniciar sesión para cancelar.' }, { status: 401 });
    }

    const { torneo_id } = await req.json();
    if (!torneo_id) {
      return NextResponse.json({ error: 'Se requiere torneo_id.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Sesión inválida. Iniciá sesión de nuevo.' }, { status: 401 });
    }

    const { data: inscripcion, error: fetchError } = await supabase
      .from('inscripciones_torneo')
      .select('id, usuario_id, estado_pago, torneo:torneos(nombre_torneo, fase_actual)')
      .eq('torneo_id', torneo_id)
      .eq('usuario_id', user.id)
      .single();

    if (fetchError || !inscripcion) {
      return NextResponse.json({ error: 'No se encontró tu inscripción en este torneo.' }, { status: 404 });
    }

    if (inscripcion.estado_pago === 'Rechazado') {
      return NextResponse.json({ error: 'La inscripción ya estaba cancelada.' }, { status: 409 });
    }

    const torneo = inscripcion.torneo as any;
    if (torneo?.fase_actual !== 'Inscripcion') {
      return NextResponse.json({ error: 'El torneo ya comenzó. No es posible cancelar la inscripción.' }, { status: 409 });
    }

    const { error: updateError } = await supabase
      .from('inscripciones_torneo')
      .update({ estado_pago: 'Rechazado' })
      .eq('id', inscripcion.id);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      mensaje: `Inscripción cancelada en el torneo ${torneo?.nombre_torneo}.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno.' }, { status: 500 });
  }
}
