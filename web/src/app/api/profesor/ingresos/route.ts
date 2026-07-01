import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 });

  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
  const primerDiaMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const hoy = now.toISOString().split('T')[0];

  const [clases, alquileres] = await Promise.all([
    supabase
      .from('reservas_clases')
      .select('monto_total_pagado, clase:clases_disponibles!inner(fecha, profesor_id)')
      .eq('clases_disponibles.profesor_id', user.id)
      .eq('estado_pago', 'Aprobado')
      .gte('clases_disponibles.fecha', primerDiaMes)
      .lte('clases_disponibles.fecha', hoy),
    supabase
      .from('alquileres_cancha')
      .select('monto_total, fecha')
      .eq('usuario_id', user.id)
      .eq('estado_pago', 'Aprobado')
      .gte('fecha', primerDiaMes)
      .lte('fecha', hoy),
  ]);

  const totalClases = (clases.data ?? []).reduce((sum: number, r: any) => sum + Number(r.monto_total_pagado ?? 0), 0);
  const totalAlquileres = (alquileres.data ?? []).reduce((sum: number, r: any) => sum + Number(r.monto_total ?? 0), 0);

  return NextResponse.json({
    mes: `${now.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`,
    total_clases: totalClases,
    total_alquileres: totalAlquileres,
    total_general: totalClases + totalAlquileres,
    cantidad_reservas_clases: clases.data?.length ?? 0,
    cantidad_alquileres: alquileres.data?.length ?? 0,
  });
}
