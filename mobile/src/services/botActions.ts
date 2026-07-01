import { supabase } from '@/lib/supabase';

const getApiBase = () =>
  (process.env.EXPO_PUBLIC_API_URL || 'https://courtup-web.vercel.app').replace(/\/$/, '');

async function getToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function callApi(path: string, body: Record<string, unknown>) {
  const token = await getToken();
  if (!token) throw new Error('No hay sesión activa.');

  const res = await fetch(`${getApiBase()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error del servidor.');
  return data;
}

// ── Canchas ─────────────────────────────────────────────────────────────────

export async function buscarCanchasDisponibles(
  fecha: string,
  horaInicio: string,
  horaFin: string,
  deporte?: 'Tenis' | 'Padel'
) {
  let q = supabase
    .from('canchas')
    .select('id, numero_cancha, deporte, superficie, precio_hora_dia, precio_hora_noche')
    .eq('activa', true);
  if (deporte) q = q.eq('deporte', deporte) as typeof q;
  const { data: canchas } = await q;

  const { data: ocupadas } = await supabase
    .from('alquileres_cancha')
    .select('cancha_id')
    .eq('fecha', fecha)
    .in('estado_pago', ['Aprobado', 'Pendiente'])
    .lt('hora_inicio', horaFin)
    .gt('hora_fin', horaInicio);

  const idsOcupados = new Set((ocupadas ?? []).map((o: any) => o.cancha_id));
  return (canchas ?? []).filter((c: any) => !idsOcupados.has(c.id));
}

export async function crearReservaCancha(params: {
  cancha_id: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  es_semanal?: boolean;
  fecha_fin_recurrencia?: string;
}) {
  return callApi('/api/canchas/reservar', params);
}

export async function cancelarReservaCancha(alquiler_id: number) {
  return callApi('/api/canchas/cancelar', { alquiler_id });
}

export async function listarMisReservasCancha(params?: {
  fecha_desde?: string;
  fecha_hasta?: string;
  solo_activas?: boolean;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa.');

  const hoy = new Date().toISOString().split('T')[0];
  let q = supabase
    .from('alquileres_cancha')
    .select('id, fecha, hora_inicio, hora_fin, monto_total, estado_pago, es_semanal, cancha:canchas(numero_cancha, deporte, superficie)')
    .eq('usuario_id', user.id)
    .gte('fecha', params?.fecha_desde ?? hoy)
    .order('fecha', { ascending: true });

  if (params?.fecha_hasta) q = q.lte('fecha', params.fecha_hasta) as typeof q;
  if (params?.solo_activas) q = q.in('estado_pago', ['Aprobado', 'Pendiente']) as typeof q;

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── Clases ───────────────────────────────────────────────────────────────────

export async function reservarClase(clase_id: number) {
  return callApi('/api/clases/reservar', { clase_id });
}

export async function cancelarReservaClase(reserva_clase_id: number) {
  return callApi('/api/clases/cancelar', { reserva_clase_id });
}

export async function listarMisClases(params?: { fecha_desde?: string; fecha_hasta?: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa.');

  const { data, error } = await (supabase
    .from('reservas_clases')
    .select(`
      id, estado_pago, monto_total_pagado,
      clase:clases_disponibles(id, fecha, hora_inicio, hora_fin, deporte, categoria_target,
        profesor:perfiles_usuarios!clases_disponibles_profesor_id_fkey(nombre)
      )
    `)
    .eq('alumno_id', user.id)
    .order('created_at', { ascending: false }) as any);

  if (error) throw new Error(error.message);
  let result = data ?? [];
  if (params?.fecha_desde) result = result.filter((r: any) => r.clase?.fecha >= params.fecha_desde!);
  if (params?.fecha_hasta) result = result.filter((r: any) => r.clase?.fecha <= params.fecha_hasta!);
  return result;
}

// ── Torneos ──────────────────────────────────────────────────────────────────

export async function buscarTorneos(params?: {
  deporte?: 'Tenis' | 'Padel';
  soloAbiertos?: boolean;
}) {
  let q = supabase
    .from('torneos')
    .select('id, nombre_torneo, categoria_torneo, deporte, fase_actual, tarifas_torneo(precio_single, precio_dobles)')
    .eq('activo', true)
    .order('creado_at', { ascending: false });

  if (params?.deporte) q = q.eq('deporte', params.deporte) as typeof q;
  if (params?.soloAbiertos) q = q.eq('fase_actual', 'Inscripcion') as typeof q;

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function inscribirTorneo(torneo_id: number, modalidad: 'Single' | 'Dobles' | 'Ambos', pareja_email?: string) {
  return callApi('/api/torneos/inscribir', { torneo_id, modalidad, pareja_email });
}

export async function cancelarInscripcionTorneo(torneo_id: number) {
  return callApi('/api/torneos/cancelar-inscripcion', { torneo_id });
}
