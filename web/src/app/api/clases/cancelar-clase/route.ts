import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Necesitás iniciar sesión para cancelar una clase.' }, { status: 401 });
    }

    const { clase_id } = await req.json();
    if (!clase_id) {
      return NextResponse.json({ error: 'Se requiere clase_id.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Sesión inválida. Iniciá sesión de nuevo.' }, { status: 401 });
    }

    const { data: perfil } = await supabase
      .from('perfiles_usuarios')
      .select('roles')
      .eq('id', user.id)
      .single();

    const esProfesor = perfil?.roles?.includes('Profesor') ?? false;
    const esOrganizador = perfil?.roles?.includes('Organizador') ?? false;

    if (!esProfesor && !esOrganizador) {
      return NextResponse.json({ error: 'Solo profesores u organizadores pueden cancelar clases.' }, { status: 403 });
    }

    const { data: clase, error: claseError } = await supabase
      .from('clases_disponibles')
      .select('id, profesor_id, activa, fecha, hora_inicio, deporte')
      .eq('id', clase_id)
      .single();

    if (claseError || !clase) {
      return NextResponse.json({ error: 'Clase no encontrada.' }, { status: 404 });
    }

    // El profesor solo puede cancelar sus propias clases; el organizador puede cancelar cualquiera
    if (esProfesor && !esOrganizador && clase.profesor_id !== user.id) {
      return NextResponse.json({ error: 'Solo podés cancelar tus propias clases.' }, { status: 403 });
    }

    if (!clase.activa) {
      return NextResponse.json({ error: 'La clase ya estaba cancelada.' }, { status: 409 });
    }

    const { error: updateError } = await supabase
      .from('clases_disponibles')
      .update({ activa: false })
      .eq('id', clase_id);

    if (updateError) throw updateError;

    // Notificar a los alumnos inscriptos
    const { data: reservas } = await supabase
      .from('reservas_clases')
      .select('alumno_id')
      .eq('clase_id', clase_id)
      .in('estado_pago', ['Aprobado', 'Pendiente']);

    if (reservas && reservas.length > 0) {
      const notificaciones = reservas.map((r) => ({
        usuario_id: r.alumno_id,
        titulo: 'Clase cancelada',
        cuerpo: `La clase de ${clase.deporte} del ${clase.fecha} a las ${String(clase.hora_inicio).substring(0, 5)} hs fue cancelada.`,
      }));
      await supabase.from('notificaciones_pendientes').insert(notificaciones);
    }

    return NextResponse.json({
      success: true,
      mensaje: `Clase cancelada. Se notificó a ${reservas?.length ?? 0} alumno(s) inscripto(s).`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno.' }, { status: 500 });
  }
}
