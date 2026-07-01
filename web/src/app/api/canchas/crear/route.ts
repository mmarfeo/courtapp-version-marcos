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
    return NextResponse.json({ error: 'Solo Organizadores pueden crear canchas.' }, { status: 403 });
  }

  const { data: membresia } = await supabase
    .from('miembros_organizacion')
    .select('organizacion_id')
    .eq('usuario_id', user.id)
    .single();

  if (!membresia) return NextResponse.json({ error: 'No pertenecés a ningún club.' }, { status: 400 });

  const body = await req.json();
  const {
    numero_cancha, deporte, superficie,
    precio_hora_dia, precio_hora_noche,
    precio_profesor_hora_dia, precio_profesor_hora_noche,
    hora_inicio_noche,
  } = body;

  if (!numero_cancha || !deporte) {
    return NextResponse.json({ error: 'numero_cancha y deporte son requeridos.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('canchas')
    .insert({
      numero_cancha,
      deporte,
      superficie: superficie ?? null,
      precio_hora_dia: precio_hora_dia ?? 0,
      precio_hora_noche: precio_hora_noche ?? 0,
      precio_profesor_hora_dia: precio_profesor_hora_dia ?? 0,
      precio_profesor_hora_noche: precio_profesor_hora_noche ?? 0,
      hora_inicio_noche: hora_inicio_noche ?? '20:00:00',
      activa: true,
      organizacion_id: membresia.organizacion_id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, cancha: data });
}
