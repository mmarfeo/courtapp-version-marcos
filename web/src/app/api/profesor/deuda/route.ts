import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 });

  const { data, error } = await supabase
    .from('alquileres_cancha')
    .select('id, fecha, hora_inicio, hora_fin, monto_total, cancha:canchas(numero_cancha, deporte)')
    .eq('usuario_id', user.id)
    .eq('estado_pago', 'Aprobado')
    .order('fecha', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const total = (data ?? []).reduce((sum: number, r: any) => sum + Number(r.monto_total ?? 0), 0);

  return NextResponse.json({
    alquileres_pendientes: data ?? [],
    total_deuda: total,
    cantidad: data?.length ?? 0,
  });
}
