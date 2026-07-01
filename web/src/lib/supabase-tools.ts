import { createClient } from '@supabase/supabase-js';

// ── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS_COMUNES = [
  {
    type: 'function',
    function: {
      name: 'consultar_canchas',
      description: 'Consulta las canchas del club: nombre, deporte (Tenis/Pádel), superficie, precio por hora y si están activas.',
      parameters: {
        type: 'object',
        properties: {
          deporte: { type: 'string', enum: ['Tenis', 'Padel'], description: 'Filtrar por deporte (opcional)' },
          solo_activas: { type: 'boolean', description: 'Si true, retorna solo canchas activas (default: true)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_profesores',
      description: 'Consulta los profesores del club: nombre, deporte que enseñan y precio por hora.',
      parameters: {
        type: 'object',
        properties: {
          deporte: { type: 'string', enum: ['Tenis', 'Padel'], description: 'Filtrar por deporte (opcional)' },
        },
      },
    },
  },
];

const TOOLS_JUGADOR = [
  ...TOOLS_COMUNES,
  {
    type: 'function',
    function: {
      name: 'buscar_canchas_disponibles',
      description: 'Muestra qué canchas están LIBRES en un horario específico. Usalo antes de crear una reserva para saber qué cancha elegir.',
      parameters: {
        type: 'object',
        required: ['fecha', 'hora_inicio', 'hora_fin'],
        properties: {
          fecha: { type: 'string', description: 'Fecha YYYY-MM-DD' },
          hora_inicio: { type: 'string', description: 'Hora de inicio HH:MM' },
          hora_fin: { type: 'string', description: 'Hora de fin HH:MM' },
          deporte: { type: 'string', enum: ['Tenis', 'Padel'], description: 'Filtrar por deporte (opcional)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crear_reserva_cancha',
      description: 'Crea una reserva de cancha para el usuario. Si es semanal, usar es_semanal=true y fecha_fin_recurrencia. Siempre confirmá con el usuario antes de ejecutar.',
      parameters: {
        type: 'object',
        required: ['cancha_id', 'fecha', 'hora_inicio', 'hora_fin'],
        properties: {
          cancha_id: { type: 'number', description: 'ID de la cancha (obtenelo de buscar_canchas_disponibles)' },
          fecha: { type: 'string', description: 'Fecha de la primera reserva YYYY-MM-DD' },
          hora_inicio: { type: 'string', description: 'Hora de inicio HH:MM:SS' },
          hora_fin: { type: 'string', description: 'Hora de fin HH:MM:SS' },
          es_semanal: { type: 'boolean', description: 'Si true, crea una reserva por semana hasta fecha_fin_recurrencia' },
          fecha_fin_recurrencia: { type: 'string', description: 'Fecha límite de recurrencia YYYY-MM-DD (requerido si es_semanal=true)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancelar_reserva_cancha',
      description: 'Cancela una reserva de cancha del usuario. SIEMPRE pedí confirmación explícita antes de ejecutar.',
      parameters: {
        type: 'object',
        required: ['alquiler_id'],
        properties: {
          alquiler_id: { type: 'number', description: 'ID del alquiler a cancelar (obtenelo de listar_mis_reservas_cancha)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_mis_reservas_cancha',
      description: 'Lista las reservas de canchas (alquileres) del usuario logueado.',
      parameters: {
        type: 'object',
        properties: {
          fecha_desde: { type: 'string', description: 'Filtrar desde YYYY-MM-DD (default: hoy)' },
          fecha_hasta: { type: 'string', description: 'Filtrar hasta YYYY-MM-DD (opcional)' },
          solo_activas: { type: 'boolean', description: 'Si true, solo muestra reservas con estado Aprobado o Pendiente' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_clases',
      description: 'Consulta las clases disponibles del club: profesor, horario, precio, cupos disponibles, deporte y categoría.',
      parameters: {
        type: 'object',
        properties: {
          deporte: { type: 'string', enum: ['Tenis', 'Padel'] },
          categoria: { type: 'string', description: 'Categoría: SuperA, A+, A, B+, B, C+, C, D' },
          fecha_desde: { type: 'string', description: 'Fecha de inicio YYYY-MM-DD (default: hoy)' },
          limit: { type: 'number', description: 'Máximo de resultados (default: 10)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reservar_clase',
      description: 'Reserva una clase para el usuario. Primero llamá a consultar_clases para obtener el ID.',
      parameters: {
        type: 'object',
        required: ['clase_id'],
        properties: {
          clase_id: { type: 'number', description: 'ID de la clase a reservar' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancelar_reserva_clase',
      description: 'Cancela la reserva de una clase. SIEMPRE pedí confirmación explícita antes de ejecutar.',
      parameters: {
        type: 'object',
        required: ['reserva_clase_id'],
        properties: {
          reserva_clase_id: { type: 'number', description: 'ID de la reserva de clase (obtenelo de consultar_mis_clases)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_mis_clases',
      description: 'Consulta las clases que el usuario ya tiene reservadas.',
      parameters: {
        type: 'object',
        properties: {
          fecha_desde: { type: 'string', description: 'Filtrar desde YYYY-MM-DD (opcional)' },
          fecha_hasta: { type: 'string', description: 'Filtrar hasta YYYY-MM-DD (opcional)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_torneos',
      description: 'Lista los torneos disponibles en el club.',
      parameters: {
        type: 'object',
        properties: {
          deporte: { type: 'string', enum: ['Tenis', 'Padel'] },
          categoria: { type: 'string', description: 'Categoría del torneo (opcional)' },
          solo_abiertos: { type: 'boolean', description: 'Si true, solo muestra torneos en fase Inscripcion' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'inscribir_torneo',
      description: 'Inscribe al usuario en un torneo. Siempre confirmá con el usuario antes de ejecutar.',
      parameters: {
        type: 'object',
        required: ['torneo_id', 'modalidad'],
        properties: {
          torneo_id: { type: 'number', description: 'ID del torneo (obtenelo de buscar_torneos)' },
          modalidad: { type: 'string', enum: ['Single', 'Dobles', 'Ambos'] },
          pareja_email: { type: 'string', description: 'Email del compañero de dobles (solo para modalidad Dobles o Ambos)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancelar_inscripcion_torneo',
      description: 'Cancela la inscripción del usuario en un torneo. SIEMPRE pedí confirmación antes de ejecutar.',
      parameters: {
        type: 'object',
        required: ['torneo_id'],
        properties: {
          torneo_id: { type: 'number', description: 'ID del torneo' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ver_mis_partidos',
      description: 'Lista los partidos del usuario en torneos.',
      parameters: {
        type: 'object',
        properties: {
          torneo_id: { type: 'number', description: 'Filtrar por torneo (opcional)' },
          estado: { type: 'string', description: 'Estado del partido (opcional)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_partidos',
      description: 'Consulta los partidos organizados en el club.',
      parameters: {
        type: 'object',
        properties: {
          estado: { type: 'string', description: 'Estado del partido' },
          fecha_desde: { type: 'string', description: 'Filtrar desde YYYY-MM-DD' },
          limit: { type: 'number', description: 'Máximo de resultados (default: 10)' },
        },
      },
    },
  },
];

const TOOLS_PROFESOR = [
  ...TOOLS_COMUNES,
  {
    type: 'function',
    function: {
      name: 'buscar_canchas_disponibles',
      description: 'Muestra qué canchas están libres en un horario. Usalo antes de crear una clase o reservar.',
      parameters: {
        type: 'object',
        required: ['fecha', 'hora_inicio', 'hora_fin'],
        properties: {
          fecha: { type: 'string', description: 'Fecha YYYY-MM-DD' },
          hora_inicio: { type: 'string', description: 'Hora de inicio HH:MM' },
          hora_fin: { type: 'string', description: 'Hora de fin HH:MM' },
          deporte: { type: 'string', enum: ['Tenis', 'Padel'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crear_clase',
      description: 'Crea una nueva clase en el sistema. Verificá disponibilidad de cancha con buscar_canchas_disponibles antes.',
      parameters: {
        type: 'object',
        required: ['cancha_id', 'fecha', 'hora_inicio', 'hora_fin', 'categoria_target', 'precio_clase', 'deporte'],
        properties: {
          cancha_id: { type: 'number', description: 'ID de la cancha' },
          fecha: { type: 'string', description: 'Fecha YYYY-MM-DD' },
          hora_inicio: { type: 'string', description: 'Hora de inicio HH:MM:SS' },
          hora_fin: { type: 'string', description: 'Hora de fin HH:MM:SS' },
          categoria_target: { type: 'string', description: 'Categoría: SuperA, A+, A, B+, B, C+, C, D' },
          precio_clase: { type: 'number', description: 'Precio de la clase en pesos' },
          cupo_maximo: { type: 'number', description: 'Cupo máximo de alumnos (default: 1)' },
          deporte: { type: 'string', enum: ['Tenis', 'Padel'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'editar_clase',
      description: 'Modifica una clase existente del profesor (precio, cupo, horario, categoría). Confirmá cambios antes.',
      parameters: {
        type: 'object',
        required: ['clase_id'],
        properties: {
          clase_id: { type: 'number', description: 'ID de la clase a editar' },
          precio_clase: { type: 'number', description: 'Nuevo precio en pesos (opcional)' },
          cupo_maximo: { type: 'number', description: 'Nuevo cupo máximo (opcional)' },
          hora_inicio: { type: 'string', description: 'Nueva hora de inicio HH:MM:SS (opcional)' },
          hora_fin: { type: 'string', description: 'Nueva hora de fin HH:MM:SS (opcional)' },
          categoria_target: { type: 'string', description: 'Nueva categoría (opcional)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_mis_clases_como_profesor',
      description: 'Lista las clases que el profesor tiene creadas.',
      parameters: {
        type: 'object',
        properties: {
          fecha_desde: { type: 'string', description: 'Filtrar desde YYYY-MM-DD (default: hoy)' },
          fecha_hasta: { type: 'string', description: 'Filtrar hasta YYYY-MM-DD (opcional)' },
          activa: { type: 'boolean', description: 'Filtrar por estado activa/inactiva (opcional)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ver_alumnos_clase',
      description: 'Muestra los alumnos inscriptos en una clase específica del profesor.',
      parameters: {
        type: 'object',
        required: ['clase_id'],
        properties: {
          clase_id: { type: 'number', description: 'ID de la clase' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancelar_clase',
      description: 'Cancela una clase propia. Notifica automáticamente a los alumnos inscriptos. SIEMPRE pedí confirmación antes.',
      parameters: {
        type: 'object',
        required: ['clase_id'],
        properties: {
          clase_id: { type: 'number', description: 'ID de la clase a cancelar' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ver_mis_alquileres_como_profesor',
      description: 'Lista las canchas que el profesor tiene reservadas (alquileres propios).',
      parameters: {
        type: 'object',
        properties: {
          fecha_desde: { type: 'string', description: 'Filtrar desde YYYY-MM-DD (default: hoy)' },
          fecha_hasta: { type: 'string', description: 'Filtrar hasta YYYY-MM-DD (opcional)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crear_reserva_cancha',
      description: 'Reserva una cancha para el profesor. Verificar disponibilidad antes con buscar_canchas_disponibles.',
      parameters: {
        type: 'object',
        required: ['cancha_id', 'fecha', 'hora_inicio', 'hora_fin'],
        properties: {
          cancha_id: { type: 'number', description: 'ID de la cancha' },
          fecha: { type: 'string', description: 'Fecha YYYY-MM-DD' },
          hora_inicio: { type: 'string', description: 'Hora de inicio HH:MM:SS' },
          hora_fin: { type: 'string', description: 'Hora de fin HH:MM:SS' },
          es_semanal: { type: 'boolean', description: 'Si true, reserva recurrente semanal' },
          fecha_fin_recurrencia: { type: 'string', description: 'Fecha límite de recurrencia YYYY-MM-DD' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancelar_reserva_cancha',
      description: 'Cancela una reserva de cancha propia. SIEMPRE pedí confirmación antes.',
      parameters: {
        type: 'object',
        required: ['alquiler_id'],
        properties: {
          alquiler_id: { type: 'number', description: 'ID del alquiler (obtenelo de ver_mis_alquileres_como_profesor)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ver_mis_ingresos',
      description: 'Muestra el resumen de ingresos del mes actual del profesor (clases + alquileres cobrados).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ver_mi_deuda',
      description: 'Muestra los alquileres de cancha aprobados que el profesor tiene pendientes de pago con el club.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

const TOOLS_ORGANIZADOR = [
  ...TOOLS_COMUNES,
  {
    type: 'function',
    function: {
      name: 'listar_todos_los_torneos',
      description: 'Lista todos los torneos con conteo de inscriptos.',
      parameters: {
        type: 'object',
        properties: {
          estado: { type: 'string', description: 'Filtrar por fase_actual (opcional)' },
          deporte: { type: 'string', enum: ['Tenis', 'Padel'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_inscripciones_torneo',
      description: 'Muestra los jugadores inscriptos en un torneo específico.',
      parameters: {
        type: 'object',
        required: ['torneo_id'],
        properties: {
          torneo_id: { type: 'number', description: 'ID del torneo' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_disponibilidad_cancha',
      description: 'Muestra el calendario de ocupación de una cancha en un rango de fechas.',
      parameters: {
        type: 'object',
        required: ['cancha_id', 'fecha_desde', 'fecha_hasta'],
        properties: {
          cancha_id: { type: 'number', description: 'ID de la cancha' },
          fecha_desde: { type: 'string', description: 'Fecha inicio YYYY-MM-DD' },
          fecha_hasta: { type: 'string', description: 'Fecha fin YYYY-MM-DD' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_todos_alquileres',
      description: 'Lista todos los alquileres de canchas del club.',
      parameters: {
        type: 'object',
        properties: {
          fecha_desde: { type: 'string', description: 'Filtrar desde YYYY-MM-DD' },
          fecha_hasta: { type: 'string', description: 'Filtrar hasta YYYY-MM-DD' },
          cancha_id: { type: 'number', description: 'Filtrar por cancha (opcional)' },
          estado_pago: { type: 'string', description: 'Filtrar por estado: Pendiente, Aprobado, Rechazado' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_profesores_y_deudas',
      description: 'Muestra los profesores y el total de sus alquileres de cancha aprobados (para gestión de deudas).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ver_pagos_pendientes',
      description: 'Lista pagos pendientes de confirmación en alquileres y reservas de clases.',
      parameters: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: ['alquiler', 'clase', 'torneo'], description: 'Filtrar por tipo (opcional)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_clases',
      description: 'Consulta todas las clases del club.',
      parameters: {
        type: 'object',
        properties: {
          deporte: { type: 'string', enum: ['Tenis', 'Padel'] },
          fecha_desde: { type: 'string' },
          limit: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crear_torneo',
      description: 'Crea un nuevo torneo en el club. Confirmá todos los datos antes de ejecutar.',
      parameters: {
        type: 'object',
        required: ['nombre_torneo', 'deporte', 'categoria_torneo', 'precio_single'],
        properties: {
          nombre_torneo: { type: 'string', description: 'Nombre del torneo' },
          deporte: { type: 'string', enum: ['Tenis', 'Padel'] },
          categoria_torneo: { type: 'string', description: 'Categoría: SuperA, A+, A, B+, B, C+, C, D' },
          precio_single: { type: 'number', description: 'Precio inscripción single' },
          precio_dobles: { type: 'number', description: 'Precio inscripción dobles (opcional)' },
          precio_ambos: { type: 'number', description: 'Precio para single + dobles (opcional)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cambiar_fase_torneo',
      description: 'Avanza el torneo a la siguiente fase. Las fases en orden son: Inscripcion → Zonas → Cuartos → Semifinal → Final → Terminado.',
      parameters: {
        type: 'object',
        required: ['torneo_id', 'nueva_fase'],
        properties: {
          torneo_id: { type: 'number', description: 'ID del torneo' },
          nueva_fase: { type: 'string', enum: ['Inscripcion', 'Zonas', 'Cuartos', 'Semifinal', 'Final', 'Terminado'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_partidos_torneo',
      description: 'Lista los partidos de un torneo con sus jugadores y estado.',
      parameters: {
        type: 'object',
        required: ['torneo_id'],
        properties: {
          torneo_id: { type: 'number', description: 'ID del torneo' },
          estado: { type: 'string', enum: ['pendiente', 'jugado', 'todos'], description: 'Filtrar por estado (default: todos)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'asignar_partido',
      description: 'Asigna fecha, hora y cancha a un partido pendiente.',
      parameters: {
        type: 'object',
        required: ['partido_id', 'fecha', 'hora', 'cancha_id'],
        properties: {
          partido_id: { type: 'number', description: 'ID del partido' },
          fecha: { type: 'string', description: 'Fecha YYYY-MM-DD' },
          hora: { type: 'string', description: 'Hora HH:MM' },
          cancha_id: { type: 'number', description: 'ID de la cancha' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'registrar_resultado',
      description: 'Registra el resultado de un partido jugado.',
      parameters: {
        type: 'object',
        required: ['partido_id', 'resultado_set1', 'ganador_pareja'],
        properties: {
          partido_id: { type: 'number', description: 'ID del partido' },
          resultado_set1: { type: 'string', description: 'Resultado set 1 (ej: "6-4")' },
          resultado_set2: { type: 'string', description: 'Resultado set 2 (ej: "6-3")' },
          resultado_set3: { type: 'string', description: 'Resultado set 3 si hubo (ej: "7-5")' },
          ganador_pareja: { type: 'number', enum: [1, 2], description: 'Pareja ganadora: 1 o 2' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crear_cancha',
      description: 'Crea una nueva cancha en el club. Confirmá todos los datos antes de ejecutar.',
      parameters: {
        type: 'object',
        required: ['numero_cancha', 'deporte', 'precio_hora_dia'],
        properties: {
          numero_cancha: { type: 'number', description: 'Número identificador de la cancha' },
          deporte: { type: 'string', enum: ['Tenis', 'Padel'] },
          superficie: { type: 'string', description: 'Superficie (ej: Arcilla, Cemento, Sintética)' },
          precio_hora_dia: { type: 'number', description: 'Precio por hora diurno' },
          precio_hora_noche: { type: 'number', description: 'Precio por hora nocturno (opcional)' },
          hora_inicio_noche: { type: 'string', description: 'Hora inicio tarifa noche HH:MM (opcional)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'editar_cancha',
      description: 'Modifica datos de una cancha existente del club.',
      parameters: {
        type: 'object',
        required: ['cancha_id'],
        properties: {
          cancha_id: { type: 'number', description: 'ID de la cancha' },
          precio_hora_dia: { type: 'number', description: 'Nuevo precio diurno (opcional)' },
          precio_hora_noche: { type: 'number', description: 'Nuevo precio nocturno (opcional)' },
          hora_inicio_noche: { type: 'string', description: 'Nueva hora inicio noche HH:MM (opcional)' },
          superficie: { type: 'string', description: 'Nueva superficie (opcional)' },
          activa: { type: 'boolean', description: 'Activar/desactivar cancha (opcional)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancelar_reserva_organizador',
      description: 'Cancela cualquier reserva de cancha del club (como organizador). SIEMPRE pedí confirmación antes.',
      parameters: {
        type: 'object',
        required: ['alquiler_id'],
        properties: {
          alquiler_id: { type: 'number', description: 'ID del alquiler a cancelar' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancelar_clase_organizador',
      description: 'Cancela una clase del club (como organizador). SIEMPRE pedí confirmación antes.',
      parameters: {
        type: 'object',
        required: ['clase_id'],
        properties: {
          clase_id: { type: 'number', description: 'ID de la clase a cancelar' },
        },
      },
    },
  },
];

const TOOLS_SUPERADMIN = [
  ...TOOLS_ORGANIZADOR,
  {
    type: 'function',
    function: {
      name: 'ver_estadisticas_sistema',
      description: 'Muestra estadísticas globales del sistema: clubs, usuarios, torneos, partidos e ingresos del mes.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ver_deudas_profesores',
      description: 'Lista los profesores con deuda pendiente de pago por alquileres de cancha aprobados.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_clubs',
      description: 'Lista todos los clubs/organizaciones registrados en la plataforma.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_staff_club',
      description: 'Lista el staff de un club (miembros y sus roles). Requiere organizacion_id para ver un club específico.',
      parameters: {
        type: 'object',
        properties: {
          organizacion_id: { type: 'string', description: 'UUID del club a consultar (opcional, si no se provee muestra todos)' },
        },
      },
    },
  },
];

// Exportar grupos por rol
export { TOOLS_JUGADOR, TOOLS_PROFESOR, TOOLS_ORGANIZADOR, TOOLS_SUPERADMIN };

// Compatibilidad con código existente (usa todas las tools)
export const SUPABASE_TOOLS = TOOLS_JUGADOR;

// ── Tool executor ────────────────────────────────────────────────────────────

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export interface ToolCall {
  id: string;
  function: { name: string; arguments: string };
}

function getUserId(userToken: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(userToken.split('.')[1], 'base64').toString('utf-8'));
    return payload.sub ?? null;
  } catch {
    return null;
  }
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';

  async function callApi(path: string, body: Record<string, unknown>) {
    if (!userToken) return JSON.stringify({ error: 'Necesitás iniciar sesión.' });
    const res = await fetch(`${appUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify(body),
    });
    return JSON.stringify(await res.json());
  }

  async function callApiGet(path: string) {
    if (!userToken) return JSON.stringify({ error: 'Necesitás iniciar sesión.' });
    const res = await fetch(`${appUrl}${path}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${userToken}` },
    });
    return JSON.stringify(await res.json());
  }

  try {
    switch (name) {

      // ── COMUNES ─────────────────────────────────────────────────────────────

      case 'consultar_canchas': {
        let q = supabase
          .from('canchas')
          .select('id, numero_cancha, deporte, superficie, precio_hora_dia, precio_hora_noche, hora_inicio_noche, activa');
        if (args.deporte) q = q.eq('deporte', args.deporte) as typeof q;
        if (args.solo_activas !== false) q = q.eq('activa', true) as typeof q;
        q = q.order('numero_cancha', { ascending: true }) as typeof q;
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

      // ── JUGADOR ─────────────────────────────────────────────────────────────

      case 'buscar_canchas_disponibles': {
        const { fecha, hora_inicio, hora_fin, deporte } = args as Record<string, string>;

        // Canchas activas
        let qCanchas = supabase
          .from('canchas')
          .select('id, numero_cancha, deporte, superficie, precio_hora_dia, precio_hora_noche')
          .eq('activa', true);
        if (deporte) qCanchas = qCanchas.eq('deporte', deporte) as typeof qCanchas;
        const { data: canchas } = await qCanchas;

        // Canchas ocupadas en ese rango
        const { data: ocupadas } = await supabase
          .from('alquileres_cancha')
          .select('cancha_id')
          .eq('fecha', fecha)
          .in('estado_pago', ['Aprobado', 'Pendiente'])
          .lt('hora_inicio', hora_fin)
          .gt('hora_fin', hora_inicio);

        const idsOcupados = new Set((ocupadas ?? []).map((o: any) => o.cancha_id));
        const disponibles = (canchas ?? []).filter((c: any) => !idsOcupados.has(c.id));
        return JSON.stringify(disponibles);
      }

      case 'crear_reserva_cancha':
        return callApi('/api/canchas/reservar', {
          cancha_id: args.cancha_id,
          fecha: args.fecha,
          hora_inicio: args.hora_inicio,
          hora_fin: args.hora_fin,
          es_semanal: args.es_semanal ?? false,
          fecha_fin_recurrencia: args.fecha_fin_recurrencia ?? null,
        });

      case 'cancelar_reserva_cancha':
        return callApi('/api/canchas/cancelar', { alquiler_id: args.alquiler_id });

      case 'listar_mis_reservas_cancha': {
        if (!userToken) return JSON.stringify({ error: 'Necesitás iniciar sesión.' });
        const userId = getUserId(userToken);
        if (!userId) return JSON.stringify({ error: 'Token de sesión inválido.' });

        const hoy = new Date().toISOString().split('T')[0];
        let q = supabase
          .from('alquileres_cancha')
          .select('id, fecha, hora_inicio, hora_fin, monto_total, estado_pago, es_semanal, cancha:canchas(numero_cancha, deporte, superficie)')
          .eq('usuario_id', userId)
          .gte('fecha', (args.fecha_desde as string) || hoy)
          .order('fecha', { ascending: true })
          .order('hora_inicio', { ascending: true });

        if (args.fecha_hasta) q = q.lte('fecha', args.fecha_hasta as string) as typeof q;
        if (args.solo_activas) q = q.in('estado_pago', ['Aprobado', 'Pendiente']) as typeof q;

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

      case 'reservar_clase':
        return callApi('/api/clases/reservar', { clase_id: args.clase_id });

      case 'cancelar_reserva_clase':
        return callApi('/api/clases/cancelar', { reserva_clase_id: args.reserva_clase_id });

      case 'consultar_mis_clases': {
        if (!userToken) return JSON.stringify({ error: 'Necesitás iniciar sesión.' });
        const userId = getUserId(userToken);
        if (!userId) return JSON.stringify({ error: 'Token de sesión inválido.' });

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
        let result = data ?? [];
        if (args.fecha_desde) result = result.filter((r: any) => r.clase?.fecha >= (args.fecha_desde as string));
        if (args.fecha_hasta) result = result.filter((r: any) => r.clase?.fecha <= (args.fecha_hasta as string));
        return JSON.stringify(result);
      }

      case 'buscar_torneos': {
        let q = supabase
          .from('torneos')
          .select('id, nombre_torneo, categoria_torneo, deporte, fase_actual, activo, tarifas_torneo(precio_single, precio_dobles, precio_ambos)')
          .eq('activo', true)
          .order('creado_at', { ascending: false });
        if (args.deporte) q = q.eq('deporte', args.deporte) as typeof q;
        if (args.categoria) q = q.eq('categoria_torneo', args.categoria) as typeof q;
        if (args.solo_abiertos) q = q.eq('fase_actual', 'Inscripcion') as typeof q;
        const { data, error } = await q;
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify(data ?? []);
      }

      case 'inscribir_torneo':
        return callApi('/api/torneos/inscribir', {
          torneo_id: args.torneo_id,
          modalidad: args.modalidad,
          pareja_email: args.pareja_email ?? null,
        });

      case 'cancelar_inscripcion_torneo':
        return callApi('/api/torneos/cancelar-inscripcion', { torneo_id: args.torneo_id });

      case 'ver_mis_partidos': {
        if (!userToken) return JSON.stringify({ error: 'Necesitás iniciar sesión.' });
        const userId = getUserId(userToken);
        if (!userId) return JSON.stringify({ error: 'Token de sesión inválido.' });

        let q = supabase
          .from('partidos')
          .select('id, fase, fecha_partido, hora_partido, resultado_set1, resultado_set2, resultado_set3, ganador_pareja, torneo:torneos(nombre_torneo, deporte), cancha:canchas(numero_cancha)')
          .or(`p1_jugador_1_id.eq.${userId},p1_jugador_2_id.eq.${userId},p2_jugador_1_id.eq.${userId},p2_jugador_2_id.eq.${userId}`)
          .order('fecha_partido', { ascending: true });

        if (args.torneo_id) q = q.eq('torneo_id', args.torneo_id) as typeof q;
        const { data, error } = await q;
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify(data ?? []);
      }

      case 'consultar_partidos': {
        let q = supabase
          .from('partidos')
          .select('id, fecha_partido, hora_partido, fase, cancha:canchas(nombre_club, deporte, numero_cancha)')
          .order('fecha_partido', { ascending: true })
          .limit((args.limit as number) || 10);
        if (args.estado) q = q.eq('fase', args.estado) as typeof q;
        if (args.fecha_desde) q = q.gte('fecha_partido', args.fecha_desde as string) as typeof q;
        const { data, error } = await q;
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify(data ?? []);
      }

      // ── PROFESOR ────────────────────────────────────────────────────────────

      case 'crear_clase':
        return callApi('/api/clases/crear', {
          cancha_id: args.cancha_id,
          fecha: args.fecha,
          hora_inicio: args.hora_inicio,
          hora_fin: args.hora_fin,
          categoria_target: args.categoria_target,
          precio_clase: args.precio_clase,
          cupo_maximo: args.cupo_maximo ?? 1,
          deporte: args.deporte,
        });

      case 'listar_mis_clases_como_profesor': {
        if (!userToken) return JSON.stringify({ error: 'Necesitás iniciar sesión.' });
        const userId = getUserId(userToken);
        if (!userId) return JSON.stringify({ error: 'Token de sesión inválido.' });

        const hoy = new Date().toISOString().split('T')[0];
        let q = supabase
          .from('clases_disponibles')
          .select('id, fecha, hora_inicio, hora_fin, deporte, categoria_target, precio_clase, cupo_maximo, activa, cancha:canchas(numero_cancha, superficie)')
          .eq('profesor_id', userId)
          .gte('fecha', (args.fecha_desde as string) || hoy)
          .order('fecha', { ascending: true });

        if (args.fecha_hasta) q = q.lte('fecha', args.fecha_hasta as string) as typeof q;
        if (args.activa !== undefined) q = q.eq('activa', args.activa) as typeof q;

        const { data, error } = await q;
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify(data ?? []);
      }

      case 'ver_alumnos_clase': {
        if (!userToken) return JSON.stringify({ error: 'Necesitás iniciar sesión.' });
        const { data, error } = await (supabase
          .from('reservas_clases')
          .select('id, estado_pago, monto_total_pagado, alumno:perfiles_usuarios!reservas_clases_alumno_id_fkey(nombre, email, categoria)')
          .eq('clase_id', args.clase_id) as any);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify(data ?? []);
      }

      case 'editar_clase':
        return callApi('/api/clases/editar', {
          clase_id: args.clase_id,
          ...(args.precio_clase !== undefined && { precio_clase: args.precio_clase }),
          ...(args.cupo_maximo !== undefined && { cupo_maximo: args.cupo_maximo }),
          ...(args.hora_inicio !== undefined && { hora_inicio: args.hora_inicio }),
          ...(args.hora_fin !== undefined && { hora_fin: args.hora_fin }),
          ...(args.categoria_target !== undefined && { categoria_target: args.categoria_target }),
        });

      case 'cancelar_clase':
        return callApi('/api/clases/cancelar-clase', { clase_id: args.clase_id });

      case 'ver_mis_ingresos':
        return callApiGet('/api/profesor/ingresos');

      case 'ver_mi_deuda':
        return callApiGet('/api/profesor/deuda');

      case 'ver_mis_alquileres_como_profesor': {
        if (!userToken) return JSON.stringify({ error: 'Necesitás iniciar sesión.' });
        const userId = getUserId(userToken);
        if (!userId) return JSON.stringify({ error: 'Token de sesión inválido.' });

        const hoy = new Date().toISOString().split('T')[0];
        let q = supabase
          .from('alquileres_cancha')
          .select('id, fecha, hora_inicio, hora_fin, monto_total, estado_pago, cancha:canchas(numero_cancha, deporte, superficie)')
          .eq('usuario_id', userId)
          .gte('fecha', (args.fecha_desde as string) || hoy)
          .order('fecha', { ascending: true });

        if (args.fecha_hasta) q = q.lte('fecha', args.fecha_hasta as string) as typeof q;

        const { data, error } = await q;
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify(data ?? []);
      }

      // ── ORGANIZADOR ─────────────────────────────────────────────────────────

      case 'listar_todos_los_torneos': {
        let q = supabase
          .from('torneos')
          .select('id, nombre_torneo, categoria_torneo, deporte, fase_actual, activo, creado_at, inscripciones_torneo(count)')
          .order('creado_at', { ascending: false });
        if (args.deporte) q = q.eq('deporte', args.deporte) as typeof q;
        if (args.estado) q = q.eq('fase_actual', args.estado) as typeof q;
        const { data, error } = await q;
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify(data ?? []);
      }

      case 'listar_inscripciones_torneo': {
        const { data, error } = await supabase
          .from('inscripciones_torneo')
          .select('id, modalidad, estado_pago, monto_total_pagado, fecha_pago, usuario:perfiles_usuarios!inscripciones_torneo_usuario_id_fkey(nombre, email, categoria), pareja_email')
          .eq('torneo_id', args.torneo_id as number)
          .order('fecha_pago', { ascending: false });
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify(data ?? []);
      }

      case 'consultar_disponibilidad_cancha': {
        const [alquileres, clases] = await Promise.all([
          supabase
            .from('alquileres_cancha')
            .select('id, fecha, hora_inicio, hora_fin, estado_pago, usuario:perfiles_usuarios!alquileres_cancha_usuario_id_fkey(nombre)')
            .eq('cancha_id', args.cancha_id as number)
            .gte('fecha', args.fecha_desde as string)
            .lte('fecha', args.fecha_hasta as string)
            .in('estado_pago', ['Aprobado', 'Pendiente'])
            .order('fecha')
            .order('hora_inicio'),
          supabase
            .from('clases_disponibles')
            .select('id, fecha, hora_inicio, hora_fin, deporte, categoria_target, activa, profesor:perfiles_usuarios!clases_disponibles_profesor_id_fkey(nombre)')
            .eq('cancha_id', args.cancha_id as number)
            .gte('fecha', args.fecha_desde as string)
            .lte('fecha', args.fecha_hasta as string)
            .eq('activa', true)
            .order('fecha')
            .order('hora_inicio'),
        ]);
        return JSON.stringify({ alquileres: alquileres.data ?? [], clases: clases.data ?? [] });
      }

      case 'listar_todos_alquileres': {
        let q = supabase
          .from('alquileres_cancha')
          .select('id, fecha, hora_inicio, hora_fin, monto_total, estado_pago, cancha:canchas(numero_cancha, deporte), usuario:perfiles_usuarios!alquileres_cancha_usuario_id_fkey(nombre, email)')
          .order('fecha', { ascending: false })
          .limit(50);
        if (args.fecha_desde) q = q.gte('fecha', args.fecha_desde as string) as typeof q;
        if (args.fecha_hasta) q = q.lte('fecha', args.fecha_hasta as string) as typeof q;
        if (args.cancha_id) q = q.eq('cancha_id', args.cancha_id as number) as typeof q;
        if (args.estado_pago) q = q.eq('estado_pago', args.estado_pago as string) as typeof q;
        const { data, error } = await q;
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify(data ?? []);
      }

      case 'listar_profesores_y_deudas': {
        const { data: profesores, error } = await supabase
          .from('perfiles_usuarios')
          .select('id, nombre, email, alquileres_cancha!alquileres_cancha_usuario_id_fkey(monto_total, estado_pago, fecha)')
          .eq('rol', 'Profesor');
        if (error) return JSON.stringify({ error: error.message });

        const resultado = (profesores ?? []).map((p: any) => {
          const alquileres = p.alquileres_cancha ?? [];
          const totalAprobado = alquileres
            .filter((a: any) => a.estado_pago === 'Aprobado')
            .reduce((sum: number, a: any) => sum + Number(a.monto_total), 0);
          return { id: p.id, nombre: p.nombre, email: p.email, total_alquileres_aprobados: totalAprobado };
        });
        return JSON.stringify(resultado);
      }

      case 'ver_pagos_pendientes': {
        const tipo = args.tipo as string | undefined;
        const resultados: Record<string, unknown[]> = {};

        if (!tipo || tipo === 'alquiler') {
          const { data } = await supabase
            .from('alquileres_cancha')
            .select('id, fecha, hora_inicio, monto_total, cancha:canchas(numero_cancha, deporte), usuario:perfiles_usuarios!alquileres_cancha_usuario_id_fkey(nombre)')
            .eq('estado_pago', 'Pendiente')
            .order('fecha', { ascending: true })
            .limit(20);
          resultados.alquileres = data ?? [];
        }

        if (!tipo || tipo === 'clase') {
          const { data } = await supabase
            .from('reservas_clases')
            .select('id, monto_total_pagado, clase:clases_disponibles(fecha, hora_inicio, deporte), alumno:perfiles_usuarios!reservas_clases_alumno_id_fkey(nombre)')
            .eq('estado_pago', 'Pendiente')
            .limit(20);
          resultados.clases = data ?? [];
        }

        if (!tipo || tipo === 'torneo') {
          const { data } = await supabase
            .from('inscripciones_torneo')
            .select('id, modalidad, monto_total_pagado, torneo:torneos(nombre_torneo), usuario:perfiles_usuarios!inscripciones_torneo_usuario_id_fkey(nombre)')
            .eq('estado_pago', 'Pendiente')
            .limit(20);
          resultados.torneos = data ?? [];
        }

        return JSON.stringify(resultados);
      }

      // ── ORGANIZADOR (nuevas) ─────────────────────────────────────────────────

      case 'crear_torneo':
        return callApi('/api/torneos/crear', {
          nombre_torneo: args.nombre_torneo,
          deporte: args.deporte,
          categoria_torneo: args.categoria_torneo,
          precio_single: args.precio_single,
          precio_dobles: args.precio_dobles ?? null,
          precio_ambos: args.precio_ambos ?? null,
        });

      case 'cambiar_fase_torneo':
        return callApi('/api/torneos/cambiar-fase', {
          torneo_id: args.torneo_id,
          nueva_fase: args.nueva_fase,
        });

      case 'listar_partidos_torneo': {
        const estado = (args.estado as string) || 'todos';
        return callApiGet(`/api/torneos/${args.torneo_id}/partidos?estado=${estado}`);
      }

      case 'asignar_partido':
        return callApi('/api/partidos/asignar', {
          partido_id: args.partido_id,
          fecha: args.fecha,
          hora: args.hora,
          cancha_id: args.cancha_id,
        });

      case 'registrar_resultado':
        return callApi('/api/partidos/resultado', {
          partido_id: args.partido_id,
          resultado_set1: args.resultado_set1,
          resultado_set2: args.resultado_set2 ?? null,
          resultado_set3: args.resultado_set3 ?? null,
          ganador_pareja: args.ganador_pareja,
        });

      case 'crear_cancha':
        return callApi('/api/canchas/crear', {
          numero_cancha: args.numero_cancha,
          deporte: args.deporte,
          superficie: args.superficie ?? null,
          precio_hora_dia: args.precio_hora_dia,
          precio_hora_noche: args.precio_hora_noche ?? null,
          hora_inicio_noche: args.hora_inicio_noche ?? null,
        });

      case 'editar_cancha':
        return callApi('/api/canchas/editar', {
          cancha_id: args.cancha_id,
          ...(args.precio_hora_dia !== undefined && { precio_hora_dia: args.precio_hora_dia }),
          ...(args.precio_hora_noche !== undefined && { precio_hora_noche: args.precio_hora_noche }),
          ...(args.hora_inicio_noche !== undefined && { hora_inicio_noche: args.hora_inicio_noche }),
          ...(args.superficie !== undefined && { superficie: args.superficie }),
          ...(args.activa !== undefined && { activa: args.activa }),
        });

      case 'cancelar_reserva_organizador':
        return callApi('/api/canchas/cancelar', { alquiler_id: args.alquiler_id });

      case 'cancelar_clase_organizador':
        return callApi('/api/clases/cancelar-clase', { clase_id: args.clase_id });

      // ── SUPERADMIN ───────────────────────────────────────────────────────────

      case 'ver_estadisticas_sistema':
        return callApiGet('/api/admin/estadisticas');

      case 'ver_deudas_profesores':
        return callApiGet('/api/admin/deudas');

      case 'listar_clubs':
        return callApiGet('/api/admin/clubs');

      case 'listar_staff_club': {
        const qs = args.organizacion_id ? `?organizacion_id=${args.organizacion_id}` : '';
        return callApiGet(`/api/admin/staff${qs}`);
      }

      default:
        return JSON.stringify({ error: `Herramienta desconocida: ${name}` });
    }
  } catch (err) {
    return JSON.stringify({ error: `Error ejecutando ${name}: ${String(err)}` });
  }
}
