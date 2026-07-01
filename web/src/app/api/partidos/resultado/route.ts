import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

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
    return NextResponse.json({ error: 'Sin permisos para registrar resultados.' }, { status: 403 });
  }

  const { partido_id, resultado_set1, resultado_set2, resultado_set3, ganador_pareja } = await req.json();
  if (!partido_id || !resultado_set1 || !resultado_set2 || ganador_pareja === undefined) {
    return NextResponse.json({ error: 'partido_id, resultado_set1, resultado_set2 y ganador_pareja son requeridos.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('partidos')
    .update({
      resultado_set1,
      resultado_set2,
      resultado_set3: resultado_set3 ?? null,
      ganador_pareja,
    })
    .eq('id', partido_id)
    .select('id, resultado_set1, resultado_set2, resultado_set3, ganador_pareja')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, partido: data });
}
