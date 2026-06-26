import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Team {
  j1: string;
  j2: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { torneo_id } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Obtener datos del torneo
    const { data: torneo, error: torneoError } = await supabase
      .from('torneos')
      .select('*')
      .eq('id', torneo_id)
      .single();

    if (torneoError || !torneo) throw new Error("Error obteniendo datos del torneo.");

    // 2. Obtener inscriptos aprobados
    const { data: inscriptos, error: inscError } = await supabase
      .from('inscripciones_torneo')
      .select('usuario_id, modalidad, pareja_usuario_id')
      .eq('torneo_id', torneo_id)
      .eq('estado_pago', 'Aprobado');

    if (inscError || !inscriptos) throw new Error("Error obteniendo inscriptos");

    const totalJugadores = inscriptos.length;
    if (totalJugadores < 2) {
      return new Response(JSON.stringify({ error: "No hay suficientes inscriptos con pago aprobado para armar el cuadro." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    // 3. Agrupación por Parejas (si es Dobles)
    const isDobles = inscriptos.some(p => p.modalidad === 'Dobles');
    const teams: Team[] = [];

    if (isDobles) {
      const pairedUserIds = new Set<string>();
      
      // 3.1. Emparejar usuarios con sus parejas invitadas registradas
      for (const player of inscriptos) {
        if (pairedUserIds.has(player.usuario_id)) continue;
        
        const partnerId = player.pareja_usuario_id;
        if (partnerId && !pairedUserIds.has(partnerId)) {
          const partnerRegistered = inscriptos.find(p => p.usuario_id === partnerId);
          if (partnerRegistered) {
            teams.push({
              j1: player.usuario_id,
              j2: partnerId
            });
            pairedUserIds.add(player.usuario_id);
            pairedUserIds.add(partnerId);
          }
        }
      }

      // 3.2. Emparejar el resto (Jugadores Libres/Sin Pareja)
      const freeAgents = inscriptos.filter(p => !pairedUserIds.has(p.usuario_id));
      for (let i = 0; i < freeAgents.length; i += 2) {
        if (i + 1 < freeAgents.length) {
          teams.push({
            j1: freeAgents[i].usuario_id,
            j2: freeAgents[i + 1].usuario_id
          });
          pairedUserIds.add(freeAgents[i].usuario_id);
          pairedUserIds.add(freeAgents[i + 1].usuario_id);
        } else {
          // Si queda un jugador impar, entra como equipo individual de 1 jugador
          teams.push({
            j1: freeAgents[i].usuario_id,
            j2: null
          });
          pairedUserIds.add(freeAgents[i].usuario_id);
        }
      }
    } else {
      // Singles: cada jugador es un equipo
      inscriptos.forEach(p => {
        teams.push({
          j1: p.usuario_id,
          j2: null
        });
      });
    }

    const totalTeams = teams.length;

    // 4. Calcular tamaño del cuadro (potencia de 2) y Byes
    const potencias = [2, 4, 8, 16, 32, 64, 128];
    const tamanoCuadro = potencias.find(p => p >= totalTeams) || 2;
    const byes = tamanoCuadro - totalTeams;

    let faseInicial = 'Dieciseisavos';
    if (tamanoCuadro === 2) faseInicial = 'Final';
    else if (tamanoCuadro === 4) faseInicial = 'Semifinal';
    else if (tamanoCuadro === 8) faseInicial = 'Cuartos';
    else if (tamanoCuadro === 16) faseInicial = 'Octavos';

    // Mezclar los equipos aleatoriamente para el armado de llaves
    const shuffledTeams = teams.sort(() => 0.5 - Math.random());

    // 5. Obtener Disponibilidades y Canchas para el Matchmaking Horario
    const { data: availabilities } = await supabase
      .from('propuestas_disponibilidad')
      .select('jugador_1_id, fecha_disponible, hora_inicio_disponible, hora_fin_disponible')
      .eq('torneo_id', torneo_id);

    const { data: canchas } = await supabase
      .from('canchas')
      .select('id')
      .eq('organizacion_id', torneo.organizacion_id)
      .eq('activa', true);

    const activeCanchas = canchas || [];

    // 5.1. Obtener la disponibilidad semanal global de las canchas
    const activeCanchasIds = activeCanchas.map(c => c.id);
    const { data: courtAvailabilities } = activeCanchasIds.length > 0 
      ? await supabase
          .from('disponibilidad_cancha_semanal')
          .select('cancha_id, dia_semana, hora_inicio')
          .in('cancha_id', activeCanchasIds)
      : { data: [], error: null };

    // Mapear disponibilidad de canchas para búsqueda rápida: "canchaId_diaSemana_hora"
    const courtAvailMap = new Set<string>();
    if (courtAvailabilities) {
      courtAvailabilities.forEach(av => {
        const timeSlot = `${av.cancha_id}_${av.dia_semana.toLowerCase()}_${av.hora_inicio.substring(0, 5)}`;
        courtAvailMap.add(timeSlot);
      });
    }

    const getDayOfWeekName = (dateStr: string): string => {
      const date = new Date(dateStr + 'T00:00:00');
      const days = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
      return days[date.getDay()];
    };

    // Mapeo de disponibilidad para búsqueda rápida: jugador -> set de slots ("fecha_hora")
    const playerAvailMap = new Map<string, Set<string>>();
    if (availabilities) {
      availabilities.forEach(av => {
        const key = av.jugador_1_id;
        const timeSlot = `${av.fecha_disponible}_${av.hora_inicio_disponible.substring(0, 5)}`;
        if (!playerAvailMap.has(key)) {
          playerAvailMap.set(key, new Set());
        }
        playerAvailMap.get(key)!.add(timeSlot);
      });
    }

    // Estructuras para evitar superposición
    const bookedPlayers = new Set<string>(); // "jugadorId_fecha_hora"
    const bookedCourts = new Set<string>();  // "canchaId_fecha_hora"

    // 6. Armado de Cruces de Partidos
    const partidosAInsertar = [];
    const cantidadPartidosRonda1 = tamanoCuadro / 2;

    for (let i = 0; i < cantidadPartidosRonda1; i++) {
      const team1 = shuffledTeams.pop();
      let team2 = null;

      // Asignar byes si corresponde
      if (shuffledTeams.length < cantidadPartidosRonda1 - i - 1 + byes) {
        // Bye
      } else {
        team2 = shuffledTeams.pop();
      }

      let fechaPartido: string | null = null;
      let horaPartido: string | null = null;
      let canchaId: number | null = null;
      let matchScheduled = false;

      if (team1 && team2) {
        // Encontrar la lista de jugadores involucrados en este partido (2 o 4)
        const matchPlayers = [team1.j1, team1.j2, team2.j1, team2.j2].filter(Boolean) as string[];

        // Buscar intersección de disponibilidad
        // Buscamos slots comunes entre todos los jugadores en la ventana de disponibilidades registradas
        const allSlots: string[] = [];
        
        // Colectamos todos los slots del primer jugador y vemos cuáles coinciden con el resto
        const firstPlayerSlots = playerAvailMap.get(matchPlayers[0]);
        if (firstPlayerSlots) {
          firstPlayerSlots.forEach(slot => {
            let common = true;
            for (let j = 1; j < matchPlayers.length; j++) {
              const otherSlots = playerAvailMap.get(matchPlayers[j]);
              if (!otherSlots || !otherSlots.has(slot)) {
                common = false;
                break;
              }
            }
            if (common) {
              allSlots.push(slot); // slot tiene formato: "YYYY-MM-DD_HH:MM"
            }
          });
        }

        // Ordenar slots cronológicamente
        allSlots.sort();

        // Intentar programar en el primer slot disponible
        for (const slot of allSlots) {
          const [fecha, hora] = slot.split('_');
          
          // Un partido dura 120 minutos (2 horas), por lo que necesitamos reservar 2 bloques consecutivos de 1 hora
          const [h, m] = hora.split(':');
          const hNum = parseInt(h);
          const hour1 = `${hNum.toString().padStart(2, '0')}:${m}:00`;
          const hour2 = `${(hNum + 1).toString().padStart(2, '0')}:${m}:00`;

          // Validar que los jugadores no tengan otro partido programado en esas horas
          let playersFree = true;
          for (const p of matchPlayers) {
            if (bookedPlayers.has(`${p}_${fecha}_${hour1}`) || bookedPlayers.has(`${p}_${fecha}_${hour2}`)) {
              playersFree = false;
              break;
            }
          }
          if (!playersFree) continue;

          // Buscar una cancha activa libre en ese horario
          let freeCanchaId: number | null = null;
          for (const c of activeCanchas) {
            // Si hay reglas de disponibilidad de canchas configuradas para este torneo, debemos respetarlas.
            // Si no hay ninguna configurada, asumimos que todas las canchas activas están disponibles.
            const hasRules = courtAvailMap.size > 0;
            const dayOfWeek = getDayOfWeekName(fecha);
            const isAvailable1 = !hasRules || courtAvailMap.has(`${c.id}_${dayOfWeek}_${hour1.substring(0, 5)}`);
            const isAvailable2 = !hasRules || courtAvailMap.has(`${c.id}_${dayOfWeek}_${hour2.substring(0, 5)}`);

            if (isAvailable1 && isAvailable2 && 
                !bookedCourts.has(`${c.id}_${fecha}_${hour1}`) && 
                !bookedCourts.has(`${c.id}_${fecha}_${hour2}`)) {
              freeCanchaId = c.id;
              break;
            }
          }

          if (freeCanchaId) {
            // Reservar jugadores y cancha para ambas horas
            for (const p of matchPlayers) {
              bookedPlayers.add(`${p}_${fecha}_${hour1}`);
              bookedPlayers.add(`${p}_${fecha}_${hour2}`);
            }
            bookedCourts.add(`${freeCanchaId}_${fecha}_${hour1}`);
            bookedCourts.add(`${freeCanchaId}_${fecha}_${hour2}`);

            fechaPartido = fecha;
            horaPartido = hour1;
            canchaId = freeCanchaId;
            matchScheduled = true;
            break;
          }
        }
      }

      partidosAInsertar.push({
        torneo_id: torneo_id,
        fase: faseInicial,
        p1_jugador_1_id: team1?.j1 || null,
        p1_jugador_2_id: team1?.j2 || null,
        p2_jugador_1_id: team2?.j1 || null,
        p2_jugador_2_id: team2?.j2 || null,
        cancha_id: canchaId,
        fecha_partido: fechaPartido,
        hora_partido: horaPartido,
        ganador_pareja: team1 && !team2 ? 1 : null, // Si es Bye, team1 gana automáticamente
        estado: team1 && !team2 ? 'confirmado' : (matchScheduled ? 'propuesto' : 'propuesto') // 'propuesto' incluso si no tiene horario asignado (sin_horario)
      });
    }

    // 7. Limpiar TODOS los partidos anteriores del torneo si los hubiere
    const { error: deleteError } = await supabase
      .from('partidos')
      .delete()
      .eq('torneo_id', torneo_id);

    if (deleteError) throw new Error("Error limpiando partidos anteriores: " + deleteError.message);

    // 8. Insertar partidos de la primera ronda
    const { data: ronda1Insertados, error: r1Error } = await supabase
      .from('partidos')
      .insert(partidosAInsertar)
      .select('id, fase, p1_jugador_1_id, p1_jugador_2_id, p2_jugador_1_id, p2_jugador_2_id, ganador_pareja');

    if (r1Error || !ronda1Insertados) {
      throw new Error("Error insertando partidos de primera ronda: " + (r1Error?.message || 'Sin datos'));
    }

    // Ordenamos por ID para asegurar el orden de las llaves
    let currentRoundMatches = ronda1Insertados.sort((a: any, b: any) => a.id - b.id);

    // Definir secuencia de fases
    const phasesSequence = ['Dieciseisavos', 'Octavos', 'Cuartos', 'Semifinal', 'Final'];
    const startIndex = phasesSequence.indexOf(faseInicial);
    
    // Generar rondas subsecuentes
    for (let r = startIndex + 1; r < phasesSequence.length; r++) {
      const nextFase = phasesSequence[r];
      const nextRoundPartidos = [];
      const numMatches = currentRoundMatches.length / 2;

      for (let i = 0; i < numMatches; i++) {
        const m1 = currentRoundMatches[i * 2];
        const m2 = currentRoundMatches[i * 2 + 1];

        // Determinar ganadores si hay byes o resultados ya definidos
        let p1_j1: string | null = null;
        let p1_j2: string | null = null;
        let p2_j1: string | null = null;
        let p2_j2: string | null = null;

        if (m1.ganador_pareja === 1) {
          p1_j1 = m1.p1_jugador_1_id;
          p1_j2 = m1.p1_jugador_2_id;
        } else if (m1.ganador_pareja === 2) {
          p1_j1 = m1.p2_jugador_1_id;
          p1_j2 = m1.p2_jugador_2_id;
        }

        if (m2 && m2.ganador_pareja === 1) {
          p2_j1 = m2.p1_jugador_1_id;
          p2_j2 = m2.p1_jugador_2_id;
        } else if (m2 && m2.ganador_pareja === 2) {
          p2_j1 = m2.p2_jugador_1_id;
          p2_j2 = m2.p2_jugador_2_id;
        }

        nextRoundPartidos.push({
          torneo_id: torneo_id,
          fase: nextFase,
          partido_previo_p1_id: m1.id,
          partido_previo_p2_id: m2 ? m2.id : null,
          p1_jugador_1_id: p1_j1,
          p1_jugador_2_id: p1_j2,
          p2_jugador_1_id: p2_j1,
          p2_jugador_2_id: p2_j2,
          estado: (p1_j1 && !p2_j1 && !m2) ? 'confirmado' : 'propuesto',
          ganador_pareja: (p1_j1 && !p2_j1 && !m2) ? 1 : null
        });
      }

      if (nextRoundPartidos.length > 0) {
        const { data: nextInserted, error: nextError } = await supabase
          .from('partidos')
          .insert(nextRoundPartidos)
          .select('id, fase, p1_jugador_1_id, p1_jugador_2_id, p2_jugador_1_id, p2_jugador_2_id, ganador_pareja');

        if (nextError || !nextInserted) {
          throw new Error(`Error insertando fase ${nextFase}: ` + (nextError?.message || 'Sin datos'));
        }

        currentRoundMatches = nextInserted.sort((a: any, b: any) => a.id - b.id);
      }
    }

    // 9. Actualizar fase actual del torneo
    await supabase
      .from('torneos')
      .update({ fase_actual: faseInicial })
      .eq('id', torneo_id);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Cuadro completo generado exitosamente desde ${faseInicial}.`,
      stats: { totalTeams, tamanoCuadro, byes }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
