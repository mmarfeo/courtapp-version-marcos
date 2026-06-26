import { supabase } from '../supabase';

export type Deporte = 'Tenis' | 'Padel';

export interface Cancha {
  id?: number;
  organizacion_id: number;
  nombre_club: string;
  numero_cancha: number;
  superficie: string;
  deporte: Deporte;
  activa: boolean;
}

/**
 * Obtiene todas las canchas correspondientes a la organización del usuario logueado.
 */
export async function fetchCanchasPorOrganizacion(organizacionId: number) {
  const { data, error } = await supabase
    .from('canchas')
    .select('*')
    .eq('organizacion_id', organizacionId)
    .order('numero_cancha', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Agrega una nueva cancha al club.
 */
export async function insertCancha(cancha: Cancha) {
  const { data, error } = await supabase
    .from('canchas')
    .insert([cancha])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Actualiza el estado activo/inactivo de una cancha.
 */
export async function toggleEstadoCancha(canchaId: number, nuevoEstado: boolean) {
  const { error } = await supabase
    .from('canchas')
    .update({ activa: nuevoEstado })
    .eq('id', canchaId);

  if (error) throw error;
  return true;
}

/**
 * Elimina (hard-delete) una cancha.
 * (En producción podría preferirse un soft-delete poniendo activa=false)
 */
export async function deleteCancha(canchaId: number) {
  const { error } = await supabase
    .from('canchas')
    .delete()
    .eq('id', canchaId);

  if (error) throw error;
  return true;
}
