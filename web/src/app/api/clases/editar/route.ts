import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 });

  const body = await req.json();
  const { clase_id, precio_clase, cupo_maximo, hora_inicio, hora_fin, categoria_target, deporte } = body;
  if (!clase_id) return NextResponse.json({ error: 'clase_id es requerido.' }, { status: 400 });

  // Verificar que el profesor sea dueño de la clase
  const { data: clase } = await supabase
    .from('clases_disponibles')
    .select('id, profesor_id')
    .eq('id', clase_id)
    .single();

  if (!clase) return NextResponse.json({ error: 'Clase no encontrada.' }, { status: 404 });

  const { data: perfil } = await supabase
    .from('perfiles_usuarios')
    .select('rol')
    .eq('id', user.id)
    .single();

  const esProfesor = perfil?.rol === 'Profesor';
  const esOrganizador = perfil?.rol === 'Organizador' || perfil?.rol === 'SuperAdmin';

  if (esProfesor && clase.profesor_id !== user.id) {
    return NextResponse.json({ error: 'Solo podés editar tus propias clases.' }, { status: 403 });
  }
  if (!esProfesor && !esOrganizador) {
    return NextResponse.json({ error: 'Sin permisos.' }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};
  if (precio_clase !== undefined) updates.precio_clase = precio_clase;
  if (cupo_maximo !== undefined) updates.cupo_maximo = cupo_maximo;
  if (hora_inicio !== undefined) updates.hora_inicio = hora_inicio;
  if (hora_fin !== undefined) updates.hora_fin = hora_fin;
  if (categoria_target !== undefined) updates.categoria_target = categoria_target;
  if (deporte !== undefined) updates.deporte = deporte;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No se enviaron campos para actualizar.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('clases_disponibles')
    .update(updates)
    .eq('id', clase_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, clase: data });
}
