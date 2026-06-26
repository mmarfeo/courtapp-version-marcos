import { supabase } from '../supabase';

/**
 * Buscador de Alumnos: Vista de reservas para la aplicación móvil
 * que filtra las ofertas del club en tiempo real, exponiendo exclusivamente
 * aquellas clases que coincidan de forma exacta con la categoría deportiva
 * del perfil del alumno.
 */

// Tipo de ejemplo para la categoría
export type CategoriaDeportiva = 'SuperA' | 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D';

export const fetchClasesParaJugador = async (
  organizacionId: number,
  categoriaJugador: CategoriaDeportiva,
  deporte: 'Tenis' | 'Padel'
) => {
  // La consulta filtra estrictamente por la categoría del jugador y el deporte,
  // y hace join con perfiles_usuarios para traer los datos del profesor.
  const { data, error } = await supabase
    .from('clases_disponibles')
    .select(`
      id,
      fecha,
      hora_inicio,
      hora_fin,
      cupo_maximo,
      precio_clase,
      deporte,
      categoria_target,
      profesor:perfiles_usuarios!clases_disponibles_profesor_id_fkey(
        nombre,
        foto_url
      ),
      cancha:canchas(
        numero_cancha,
        superficie
      )
    `)
    .eq('organizacion_id', organizacionId)
    .eq('categoria_target', categoriaJugador)
    .eq('deporte', deporte)
    .eq('activa', true)
    .gte('fecha', new Date().toISOString().split('T')[0]) // Solo clases futuras o de hoy
    .order('fecha', { ascending: true })
    .order('hora_inicio', { ascending: true });

  if (error) {
    console.error('Error fetching clases para jugador:', error);
    throw error;
  }

  return data;
};
