import { supabase } from '../supabase';

/**
 * Consulta de agregación financiera global para el SuperAdmin.
 * Esta función suma la columna "comision_plataforma" de las tres tablas
 * principales donde haya habido cobros (Reservas, Torneos, Alquileres)
 * y cuyo estado_pago sea 'Aprobado'.
 */
export async function fetchMetricasGlobales() {
  // Nota: En producción, para dashboards complejos, esto se realizaría
  // idealmente mediante una VISTA materializada o RPC en PostgreSQL.
  // Aquí usamos promesas concurrentes para demostrar el acceso a datos.
  
  const [reservas, torneos, alquileres] = await Promise.all([
    supabase.from('reservas_clases').select('comision_plataforma').eq('estado_pago', 'Aprobado'),
    supabase.from('inscripciones_torneo').select('comision_plataforma').eq('estado_pago', 'Aprobado'),
    supabase.from('alquileres_cancha').select('comision_plataforma').eq('estado_pago', 'Aprobado'),
  ]);

  const sumarComisiones = (data: any[] | null) => 
    data?.reduce((acc, curr) => acc + Number(curr.comision_plataforma), 0) || 0;

  const totalReservas = sumarComisiones(reservas.data);
  const totalTorneos = sumarComisiones(torneos.data);
  const totalAlquileres = sumarComisiones(alquileres.data);

  return {
    recaudacionTotal: totalReservas + totalTorneos + totalAlquileres,
    desglose: {
      clases: totalReservas,
      torneos: totalTorneos,
      alquileres: totalAlquileres
    }
  };
}

/**
 * Obtener listado de organizaciones para suspender/reactivar.
 */
export async function fetchOrganizaciones() {
  const { data, error } = await supabase
    .from('organizaciones')
    .select('id, nombre, slug, activa, creado_at')
    .order('creado_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Activar o desactivar un club.
 */
export async function toggleEstadoOrganizacion(orgId: number, nuevoEstado: boolean) {
  const { error } = await supabase
    .from('organizaciones')
    .update({ activa: nuevoEstado })
    .eq('id', orgId);

  if (error) throw error;
  return true;
}

/**
 * Crear una nueva organización.
 */
export async function createOrganizacion(data: { nombre: string; slug: string; mp_access_token?: string; mp_user_id?: string; activa?: boolean }) {
  const { data: nuevaOrg, error } = await supabase
    .from('organizaciones')
    .insert([data])
    .select()
    .single();

  if (error) throw error;
  return nuevaOrg;
}

/**
 * Obtener una organización específica por su ID.
 */
export async function fetchOrganizacionById(id: number | string) {
  const { data, error } = await supabase
    .from('organizaciones')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Actualizar una organización existente.
 */
export async function updateOrganizacion(id: number | string, data: Partial<{ nombre: string; slug: string; mp_access_token: string; mp_user_id: string; activa: boolean }>) {
  const { data: orgActualizada, error } = await supabase
    .from('organizaciones')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return orgActualizada;
}
