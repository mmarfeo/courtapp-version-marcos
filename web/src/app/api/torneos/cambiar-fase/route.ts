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
    return NextResponse.json({ error: 'Sin permisos para cambiar fase.' }, { status: 403 });
  }

  const { torneo_id, nueva_fase } = await req.json();
  if (!torneo_id || !nueva_fase) {
    return NextResponse.json({ error: 'torneo_id y nueva_fase son requeridos.' }, { status: 400 });
  }
  if (!FASES_VALIDAS.includes(nueva_fase)) {
    return NextResponse.json({ error: `Fase inválida. Valores posibles: ${FASES_VALIDAS.join(', ')}` }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('torneos')
    .update({ fase_actual: nueva_fase })
    .eq('id', torneo_id)
    .select('id, nombre_torneo, fase_actual')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, torneo: data });
}
