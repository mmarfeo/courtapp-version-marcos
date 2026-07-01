import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const estado = searchParams.get('estado'); // pendiente | jugado | todos

  let q = supabase
    .from('partidos')
    .select(`
      id, fase, fecha_partido, hora_partido,
      resultado_set1, resultado_set2, resultado_set3, ganador_pareja,
      cancha:canchas(numero_cancha, deporte),
      p1j1:perfiles_usuarios!partidos_p1_jugador_1_id_fkey(nombre),
      p1j2:perfiles_usuarios!partidos_p1_jugador_2_id_fkey(nombre),
      p2j1:perfiles_usuarios!partidos_p2_jugador_1_id_fkey(nombre),
      p2j2:perfiles_usuarios!partidos_p2_jugador_2_id_fkey(nombre)
    `)
    .eq('torneo_id', params.id)
    .order('fecha_partido', { ascending: true, nullsFirst: true });

  if (estado === 'pendiente') q = q.is('resultado_set1', null) as typeof q;
  if (estado === 'jugado') q = q.not('resultado_set1', 'is', null) as typeof q;

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ partidos: data ?? [] });
}
