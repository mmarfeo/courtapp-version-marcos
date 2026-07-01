import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
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

  if (!['SuperAdmin', 'Organizador'].includes(perfil?.rol)) {
    return NextResponse.json({ error: 'Sin permisos.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const organizacion_id = searchParams.get('organizacion_id');

  let q = supabase
    .from('miembros_organizacion')
    .select(`
      id, roles,
      usuario:perfiles_usuarios!miembros_organizacion_usuario_id_fkey(id, nombre, email, rol),
      organizacion:organizaciones!miembros_organizacion_organizacion_id_fkey(nombre)
    `)
    .order('created_at', { ascending: false });

  if (organizacion_id) {
    q = q.eq('organizacion_id', organizacion_id) as typeof q;
  } else if (perfil?.rol === 'Organizador') {
    const { data: membresia } = await supabase
      .from('miembros_organizacion')
      .select('organizacion_id')
      .eq('usuario_id', user.id)
      .single();
    if (membresia) q = q.eq('organizacion_id', membresia.organizacion_id) as typeof q;
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff: data ?? [] });
}
