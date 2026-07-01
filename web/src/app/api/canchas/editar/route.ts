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
    return NextResponse.json({ error: 'Sin permisos para editar canchas.' }, { status: 403 });
  }

  const body = await req.json();
  const { cancha_id, ...campos } = body;
  if (!cancha_id) return NextResponse.json({ error: 'cancha_id es requerido.' }, { status: 400 });

  // Verificar que la cancha pertenece al club del organizador
  const { data: membresia } = await supabase
    .from('miembros_organizacion')
    .select('organizacion_id')
    .eq('usuario_id', user.id)
    .single();

  const { data: cancha } = await supabase
    .from('canchas')
    .select('organizacion_id')
    .eq('id', cancha_id)
    .single();

  if (!cancha) return NextResponse.json({ error: 'Cancha no encontrada.' }, { status: 404 });
  if (perfil?.rol !== 'SuperAdmin' && cancha.organizacion_id !== membresia?.organizacion_id) {
    return NextResponse.json({ error: 'La cancha no pertenece a tu club.' }, { status: 403 });
  }

  const allowedFields = [
    'numero_cancha', 'deporte', 'superficie', 'activa',
    'precio_hora_dia', 'precio_hora_noche',
    'precio_profesor_hora_dia', 'precio_profesor_hora_noche',
    'hora_inicio_noche',
  ];
  const updates: Record<string, unknown> = {};
  for (const f of allowedFields) {
    if (campos[f] !== undefined) updates[f] = campos[f];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No se enviaron campos para actualizar.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('canchas')
    .update(updates)
    .eq('id', cancha_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, cancha: data });
}
