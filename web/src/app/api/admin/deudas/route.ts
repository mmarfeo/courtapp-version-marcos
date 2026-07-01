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

  const { data: profesores, error } = await supabase
    .from('perfiles_usuarios')
    .select(`
      id, nombre, email,
      alquileres:alquileres_cancha!alquileres_cancha_usuario_id_fkey(id, monto_total, estado_pago, fecha, cancha:canchas(numero_cancha, deporte))
    `)
    .eq('rol', 'Profesor');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const resultado = (profesores ?? []).map((p: any) => {
    const pendientes = (p.alquileres ?? []).filter((a: any) => a.estado_pago === 'Aprobado');
    const totalDeuda = pendientes.reduce((sum: number, a: any) => sum + Number(a.monto_total ?? 0), 0);
    return {
      id: p.id,
      nombre: p.nombre,
      email: p.email,
      total_deuda: totalDeuda,
      cantidad_alquileres: pendientes.length,
      alquileres: pendientes,
    };
  }).filter((p: any) => p.total_deuda > 0);

  return NextResponse.json({ profesores: resultado });
}
