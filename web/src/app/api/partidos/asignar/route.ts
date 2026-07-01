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
    return NextResponse.json({ error: 'Sin permisos para asignar partidos.' }, { status: 403 });
  }

  const { partido_id, fecha, hora, cancha_id } = await req.json();
  if (!partido_id) return NextResponse.json({ error: 'partido_id es requerido.' }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (fecha) updates.fecha_partido = fecha;
  if (hora) updates.hora_partido = hora;
  if (cancha_id) updates.cancha_id = cancha_id;

  const { data, error } = await supabase
    .from('partidos')
    .update(updates)
    .eq('id', partido_id)
    .select('id, fecha_partido, hora_partido, cancha_id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, partido: data });
}
