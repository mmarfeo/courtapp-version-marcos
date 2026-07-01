import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Necesitás iniciar sesión para crear una clase.' }, { status: 401 });
    }

    const body = await req.json();
    const { cancha_id, fecha, hora_inicio, hora_fin, categoria_target, precio_clase, cupo_maximo, deporte } = body;

    if (!cancha_id || !fecha || !hora_inicio || !hora_fin || !categoria_target || !precio_clase || !deporte) {
      return NextResponse.json(
        { error: 'Faltan parámetros: cancha_id, fecha, hora_inicio, hora_fin, categoria_target, precio_clase, deporte.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Sesión inválida. Iniciá sesión de nuevo.' }, { status: 401 });
    }

    const { data: perfil, error: perfilError } = await supabase
      .from('perfiles_usuarios')
      .select('roles')
      .eq('id', user.id)
      .single();

    if (perfilError || !perfil?.roles?.includes('Profesor')) {
      return NextResponse.json({ error: 'Solo los profesores pueden crear clases.' }, { status: 403 });
    }

    // Obtener organización del profesor
    const { data: membresia } = await supabase
      .from('miembros_organizacion')
      .select('organizacion_id')
      .eq('usuario_id', user.id)
      .limit(1)
      .single();

    if (!membresia) {
      return NextResponse.json({ error: 'El profesor no pertenece a ninguna organización.' }, { status: 400 });
    }

    const { error: insertError } = await supabase.from('clases_disponibles').insert({
      organizacion_id: membresia.organizacion_id,
      profesor_id: user.id,
      cancha_id,
      fecha,
      hora_inicio,
      hora_fin,
      categoria_target,
      precio_clase,
      cupo_maximo: cupo_maximo ?? 1,
      deporte,
      activa: true,
    });

    if (insertError) throw insertError;

    return NextResponse.json({
      success: true,
      mensaje: `Clase de ${deporte} creada para el ${fecha} de ${hora_inicio.substring(0, 5)} a ${hora_fin.substring(0, 5)} hs. Categoría: ${categoria_target}.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno.' }, { status: 500 });
  }
}
