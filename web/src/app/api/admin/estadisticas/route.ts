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

  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
  const primerDiaMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const hoy = now.toISOString().split('T')[0];

  const [
    clubs, usuarios, torneos, partidos,
    alquileresMes, clasesMes, inscripcionesMes,
  ] = await Promise.all([
    supabase.from('organizaciones').select('id', { count: 'exact', head: true }),
    supabase.from('perfiles_usuarios').select('id', { count: 'exact', head: true }),
    supabase.from('torneos').select('id, fase_actual, activo').eq('activo', true),
    supabase.from('partidos').select('id', { count: 'exact', head: true }).is('resultado_set1', null),
    supabase.from('alquileres_cancha').select('monto_total').eq('estado_pago', 'Aprobado').gte('fecha', primerDiaMes).lte('fecha', hoy),
    supabase.from('reservas_clases').select('monto_total_pagado').eq('estado_pago', 'Aprobado'),
    supabase.from('inscripciones_torneo').select('monto_total_pagado').eq('estado_pago', 'Aprobado'),
  ]);

  const torneosActivos = (torneos.data ?? []).filter((t: any) => t.activo);
  const torneosAbiertos = torneosActivos.filter((t: any) => t.fase_actual === 'Inscripcion');

  const ingresoAlquileres = (alquileresMes.data ?? []).reduce((s: number, r: any) => s + Number(r.monto_total ?? 0), 0);
  const ingresoClases = (clasesMes.data ?? []).reduce((s: number, r: any) => s + Number(r.monto_total_pagado ?? 0), 0);
  const ingresoTorneos = (inscripcionesMes.data ?? []).reduce((s: number, r: any) => s + Number(r.monto_total_pagado ?? 0), 0);

  return NextResponse.json({
    total_clubs: clubs.count ?? 0,
    total_usuarios: usuarios.count ?? 0,
    torneos_activos: torneosActivos.length,
    torneos_abiertos_inscripcion: torneosAbiertos.length,
    partidos_pendientes: partidos.count ?? 0,
    ingresos_mes: {
      alquileres: ingresoAlquileres,
      clases: ingresoClases,
      torneos: ingresoTorneos,
      total: ingresoAlquileres + ingresoClases + ingresoTorneos,
    },
    periodo: `${primerDiaMes} al ${hoy}`,
  });
}
