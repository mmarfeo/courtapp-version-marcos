import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const FASES_VALIDAS = ['Inscripcion', 'Zonas', 'Cuartos', 'Semifinal', 'Final', 'Terminado'];

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 });

  const { data: perfil } = await supabase
    .from('perfiles_usuarios')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (!['Organizador', 'SuperAdmin'].includes(perfil?.rol)) {
    return NextResponse.json({ error: 'Solo Organizadores pueden crear torneos.' }, { status: 403 });
  }

  const { data: membresia } = await supabase
    .from('miembros_organizacion')
    .select('organizacion_id')
    .eq('usuario_id', user.id)
    .single();

  if (!membresia) return NextResponse.json({ error: 'No pertenecés a ningún club.' }, { status: 400 });

  const body = await req.json();
  const {
    nombre_torneo, deporte, categorias, precio_single, precio_dobles, precio_ambos,
    fecha_inicio, formato_sets, partidos_asegurados, clasificados_por_zona,
  } = body;

  if (!nombre_torneo || !deporte || !categorias?.length) {
    return NextResponse.json({ error: 'nombre_torneo, deporte y categorias son requeridos.' }, { status: 400 });
  }

  const { data: torneo, error: errTorneo } = await supabase
    .from('torneos')
    .insert({
      nombre_torneo,
      deporte,
      categoria_torneo: Array.isArray(categorias) ? categorias.join(', ') : categorias,
      fase_actual: 'Inscripcion',
      activo: true,
      organizacion_id: membresia.organizacion_id,
      fecha_inicio: fecha_inicio ?? null,
      formato_sets: formato_sets ?? 3,
      partidos_asegurados: partidos_asegurados ?? null,
      clasificados_por_zona: clasificados_por_zona ?? null,
    })
    .select('id')
    .single();

  if (errTorneo) return NextResponse.json({ error: errTorneo.message }, { status: 500 });

  if (precio_single || precio_dobles || precio_ambos) {
    await supabase.from('tarifas_torneo').insert({
      torneo_id: torneo.id,
      precio_single: precio_single ?? 0,
      precio_dobles: precio_dobles ?? 0,
      precio_ambos: precio_ambos ?? 0,
    });
  }

  return NextResponse.json({ success: true, torneo_id: torneo.id });
}
