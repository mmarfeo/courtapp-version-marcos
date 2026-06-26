import { createClient } from '@supabase/supabase-js';

// ── Tool definitions (OpenAI/Ollama function calling format) ─────────────────

export const SUPABASE_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'consultar_canchas',
      description:
        'Consulta las canchas del club: nombre, deporte (Tenis/Pádel), superficie, precio por hora y si están activas.',
      parameters: {
        type: 'object',
        properties: {
          deporte: {
            type: 'string',
            enum: ['Tenis', 'Padel'],
            description: 'Filtrar por deporte (opcional)',
          },
          solo_activas: {
            type: 'boolean',
            description: 'Si true, retorna solo canchas activas (default: true)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_clases',
      description:
        'Consulta las clases disponibles del club: profesor, horario, precio, cupos disponibles, deporte y categoría.',
      parameters: {
        type: 'object',
        properties: {
          deporte: {
            type: 'string',
            enum: ['Tenis', 'Padel'],
            description: 'Filtrar por deporte',
          },
          categoria: {
            type: 'string',
            description: 'Categoría del jugador: SuperA, A+, A, B+, B, C+, C, D',
          },
          fecha_desde: {
            type: 'string',
            description: 'Fecha de inicio YYYY-MM-DD (default: hoy)',
          },
          limit: {
            type: 'number',
            description: 'Máximo de resultados (default: 10)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_partidos',
      description:
        'Consulta los partidos organizados en el club: jugadores, cancha, fecha, horario y estado.',
      parameters: {
        type: 'object',
        properties: {
          estado: {
            type: 'string',
            description: 'Estado del partido (activo, completado, cancelado)',
          },
          fecha_desde: {
            type: 'string',
            description: 'Filtrar partidos desde esta fecha YYYY-MM-DD',
          },
          limit: {
            type: 'number',
            description: 'Máximo de resultados (default: 10)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_reservas',
      description:
        'Consulta las reservas de canchas (alquileres): qué canchas están ocupadas u libres en una fecha y horario.',
      parameters: {
        type: 'object',
        properties: {
          fecha: {
            type: 'string',
            description: 'Fecha de la reserva YYYY-MM-DD (default: hoy)',
          },
          cancha_id: {
            type: 'number',
            description: 'ID de cancha específica (opcional)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_profesores',
      description:
        'Consulta los profesores del club: nombre, deporte que enseñan, precio por hora y disponibilidad.',
      parameters: {
        type: 'object',
        properties: {
          deporte: {
            type: 'string',
            enum: ['Tenis', 'Padel'],
            description: 'Filtrar por deporte (opcional)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_mis_clases',
      description:
        'Consulta las clases que el usuario ya tiene reservadas. Úsalo cuando el usuario pregunte por sus reservas de clases, clases anotadas, o historial de clases.',
      parameters: {
        type: 'object',
        properties: {
          fecha_desde: {
            type: 'string',
            description: 'Filtrar desde esta fecha YYYY-MM-DD (opcional)',
          },
          fecha_hasta: {
            type: 'string',
            description: 'Filtrar hasta esta fecha YYYY-MM-DD (opcional)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reservar_clase',
      description:
        'Reserva una clase para el usuario actualmente logueado. Usá este tool cuando el usuario quiera inscribirse o reservar una clase específica. Primero consultá las clases disponibles para obtener el ID correcto.',
      parameters: {
        type: 'object',
        required: ['clase_id'],
        properties: {
          clase_id: {
            type: 'number',
            description: 'ID numérico de la clase a reservar (obtenelo de consultar_clases)',
          },
        },
      },
    },
  },
];

// ── Tool executor ────────────────────────────────────────────────────────────

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

export async function executeToolCall(toolCall: ToolCall, userToken?: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const name = toolCall.function.name;
  let args: Record<string, unknown> = {};

  try {
    args = JSON.parse(toolCall.function.arguments || '{}');
  } catch {
    return JSON.stringify({ error: 'Argumentos inválidos' });
  }

  try {
    switch (name) {
      case 'consultar_canchas': {
        let q = supabase.from('canchas').select('id, nombre, deporte, superficie, precio_por_hora, activa, numero_cancha');
        if (args.deporte) q = q.eq('deporte', args.deporte) as typeof q;
        if (args.solo_activas !== false) q = q.eq('activa', true) as typeof q;
        q = q.order('numero_cancha', { ascending: true }) as typeof q;
        const { data, error } = await q;
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify(data ?? []);
      }

      case 'consultar_clases': {
        const hoy = new Date().toISOString().split('T')[0];
        let q = supabase
          .from('clases_disponibles')
          .select(`
            id, fecha, hora_inicio, hora_fin, cupo_maximo, precio_clase, deporte, categoria_target, activa,
            profesor:perfiles_usuarios!clases_disponibles_profesor_id_fkey(nombre, foto_url),
            cancha:canchas(numero_cancha, superficie)
          `)
          .eq('activa', true)
          .gte('fecha', (args.fecha_desde as string) || hoy)
          .order('fecha', { ascending: true })
          .order('hora_inicio', { ascending: true })
          .limit((args.limit as number) || 10);
        if (args.deporte) q = q.eq('deporte', args.deporte) as typeof q;
        if (args.categoria) q = q.eq('categoria_target', args.categoria) as typeof q;
        const { data, error } = await q;
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify(data ?? []);
      }

      case 'consultar_partidos': {
        let q = supabase
          .from('partidos')
          .select('id, fecha, hora_inicio, hora_fin, estado, cancha:canchas(nombre, deporte, numero_cancha)')
          .order('fecha', { ascending: true })
          .limit((args.limit as number) || 10);
        if (args.estado) q = q.eq('estado', args.estado) as typeof q;
        if (args.fecha_desde) q = q.gte('fecha', args.fecha_desde as string) as typeof q;
        const { data, error } = await q;
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify(data ?? []);
      }

      case 'consultar_reservas': {
        const hoy = new Date().toISOString().split('T')[0];
        let q = supabase
          .from('alquileres_cancha')
          .select('id, fecha, hora_inicio, hora_fin, estado_pago, cancha:canchas(id, nombre, numero_cancha, deporte)')
          .eq('fecha', (args.fecha as string) || hoy)
          .in('estado_pago', ['Aprobado', 'Pendiente'])
          .order('hora_inicio', { ascending: true });
        if (args.cancha_id) q = q.eq('cancha_id', args.cancha_id as number) as typeof q;
        const { data, error } = await q;
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify(data ?? []);
      }

      case 'consultar_profesores': {
        let q = supabase
          .from('perfiles_usuarios')
          .select('id, nombre, foto_url, precio_clase_tenis, precio_clase_padel')
          .eq('rol', 'Profesor');
        if (args.deporte === 'Tenis') q = q.not('precio_clase_tenis', 'is', null) as typeof q;
        if (args.deporte === 'Padel') q = q.not('precio_clase_padel', 'is', null) as typeof q;
        const { data, error } = await q;
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify(data ?? []);
      }

      case 'consultar_mis_clases': {
        if (!userToken) {
          return JSON.stringify({ error: 'Necesitás iniciar sesión para ver tus clases.' });
        }
        let userId: string;
        try {
          const payload = JSON.parse(Buffer.from(userToken.split('.')[1], 'base64').toString('utf-8'));
          userId = payload.sub;
          if (!userId) throw new Error('sin sub');
        } catch {
          return JSON.stringify({ error: 'Token de sesión inválido.' });
        }

        const { data, error } = await (supabase
          .from('reservas_clases')
          .select(`
            id, created_at, estado_pago, monto_total_pagado,
            clase:clases_disponibles(
              id, fecha, hora_inicio, hora_fin, deporte, categoria_target,
              profesor:perfiles_usuarios!clases_disponibles_profesor_id_fkey(nombre)
            )
          `)
          .eq('alumno_id', userId)
          .order('created_at', { ascending: false }) as any);

        if (error) return JSON.stringify({ error: error.message });

        // Filter by date range in JS (PostgREST can't filter on joined columns)
        let result = data ?? [];
        if (args.fecha_desde) {
          result = result.filter((r: any) => r.clase?.fecha >= (args.fecha_desde as string));
        }
        if (args.fecha_hasta) {
          result = result.filter((r: any) => r.clase?.fecha <= (args.fecha_hasta as string));
        }
        return JSON.stringify(result);
      }

      case 'reservar_clase': {
        if (!userToken) {
          return JSON.stringify({ error: 'Necesitás iniciar sesión para reservar una clase.' });
        }
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
        const res = await fetch(`${appUrl}/api/clases/reservar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({ clase_id: args.clase_id }),
        });
        const data = await res.json();
        return JSON.stringify(data);
      }

      default:
        return JSON.stringify({ error: `Herramienta desconocida: ${name}` });
    }
  } catch (err) {
    return JSON.stringify({ error: `Error ejecutando ${name}: ${String(err)}` });
  }
}
