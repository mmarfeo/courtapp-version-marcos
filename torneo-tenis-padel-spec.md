# 🎾 App de Torneos de Tenis y Pádel — Especificación de Producto

## Resumen

Aplicación para gestión de torneos de tenis y pádel en clubes deportivos. Permite a profesores/organizadores crear torneos por club y categoría, a jugadores inscribirse en singles o dobles, indicar su disponibilidad horaria y que un motor de inteligencia artificial genere automáticamente los cruces de partidos respetando la disponibilidad de cada jugador.

---

## Roles de Usuario

### 🧑‍🏫 Profesor / Organizador
Crea y administra torneos dentro de su club. Define las categorías participantes, las fechas del torneo y las reglas generales.

### 🎾 Jugador
Se inscribe en torneos disponibles, elige modalidad (singles, dobles o ambas) y declara su disponibilidad semanal para que el sistema pueda programar sus partidos.

---

## Módulo 1 — Creación de Torneo (Profesor)

### Campos requeridos al crear un torneo

| Campo | Tipo | Descripción |
|---|---|---|
| `nombre` | texto | Nombre del torneo |
| `club` | selector | Club donde se juega |
| `deporte` | selector | Tenis / Pádel |
| `categorias` | multi-selector | Ej: Primera, Segunda, Libre, Senior |
| `modalidades` | checkbox | Singles / Dobles / Ambas |
| `fecha_inicio` | fecha | Inicio de inscripciones |
| `fecha_fin_inscripcion` | fecha | Cierre de inscripciones |
| `fecha_inicio_partidos` | fecha | Primer partido posible |
| `fecha_fin_torneo` | fecha | Deadline final del torneo |
| `max_jugadores_por_categoria` | número | Cupo máximo por categoría |
| `formato` | selector | Eliminación directa / Round Robin / Grupos + playoffs |

### Comportamiento esperado
- El torneo queda en estado `borrador` hasta que el profesor lo publique.
- Al publicarlo, los jugadores del club pueden verlo y anotarse.
- El profesor puede cerrar inscripciones manualmente antes del deadline.

---

## Módulo 2 — Inscripción del Jugador

### Flujo de inscripción

```
Ver torneos disponibles
  → Seleccionar torneo
    → Seleccionar categoría
      → Elegir modalidad (Singles / Dobles / Ambas)
        → Completar disponibilidad horaria
          → Confirmar inscripción
```

### Selección de modalidad

**Singles:** el jugador se inscribe solo.

**Dobles:** el jugador puede:
- Invitar a un compañero registrado en el sistema
- Registrarse como disponible para que el sistema le asigne pareja

**Ambas:** se generan dos inscripciones independientes (una en el cuadro de singles y una en el de dobles).

---

## Módulo 3 — Disponibilidad Horaria del Jugador

Este es el corazón del sistema de scheduling inteligente. Al inscribirse, cada jugador completa una grilla de disponibilidad.

### Estructura de la disponibilidad

```json
{
  "jugador_id": "uuid",
  "torneo_id": "uuid",
  "modalidad": "singles | dobles | ambas",
  "disponibilidad": {
    "lunes":     ["08:00-10:00", "18:00-21:00"],
    "martes":    [],
    "miercoles": ["09:00-11:00", "19:00-22:00"],
    "jueves":    ["08:00-10:00"],
    "viernes":   ["17:00-20:00"],
    "sabado":    ["08:00-13:00"],
    "domingo":   ["08:00-12:00"]
  }
}
```

### UI recomendada: grilla semanal interactiva

- Eje X: días de la semana (Lun–Dom)
- Eje Y: franjas horarias (ej. cada 1 hora, de 07:00 a 23:00)
- El jugador selecciona con click/tap las celdas disponibles
- Las celdas seleccionadas se destacan en verde
- Opción para copiar disponibilidad de un día a otros

### Validaciones

- El jugador debe marcar al menos 3 franjas distintas para poder inscribirse
- Se puede editar la disponibilidad hasta el cierre de inscripciones

---

## Módulo 4 — Motor de Matching con IA

### Objetivo

Dado un torneo, una ronda y el conjunto de jugadores con su disponibilidad, el motor de IA debe:

1. Emparejar los jugadores según el formato del torneo (brackets, grupos, etc.)
2. Encontrar franjas horarias en común para cada par/grupo
3. Proponer el horario de cada partido
4. Resolver conflictos (jugador en singles y dobles en el mismo turno)

---

### Algoritmo de matching por ronda

#### Inputs
```
- Lista de jugadores clasificados para la ronda
- Disponibilidad horaria de cada jugador
- Canchas disponibles en el club (cantidad y tipo)
- Duración estimada del partido (ej. 90 min)
- Ventana temporal de la ronda (fecha_inicio – fecha_limite)
```

#### Proceso

**Paso 1 — Generar cruces**

Según el formato del torneo, generar los pares de jugadores que deben enfrentarse en la ronda. Puede ser aleatorio (primera ronda) o según ranking/posición en el cuadro (rondas siguientes).

**Paso 2 — Encontrar slots comunes**

Para cada par `(jugador_A, jugador_B)`:
```
slots_comunes = disponibilidad_A ∩ disponibilidad_B
```

Filtrar los slots que:
- Estén dentro de la ventana temporal de la ronda
- Tengan duración suficiente para el partido
- No colisionen con otros partidos del mismo jugador en esa misma ronda

**Paso 3 — Asignar canchas**

Iterar los slots comunes de todos los partidos e intentar distribuirlos sin superposición en las canchas disponibles.

**Paso 4 — Generar propuesta**

Salida del motor:
```json
{
  "ronda": 1,
  "partidos": [
    {
      "partido_id": "uuid",
      "jugador_a": "...",
      "jugador_b": "...",
      "fecha": "2025-08-14",
      "hora_inicio": "19:00",
      "hora_fin": "20:30",
      "cancha": "Cancha 3",
      "estado": "propuesto"
    }
  ],
  "sin_horario": [
    {
      "jugador_a": "...",
      "jugador_b": "...",
      "motivo": "sin franjas comunes en la ventana de la ronda"
    }
  ]
}
```

**Paso 5 — Manejo de conflictos**

Si no hay slots comunes:
- Notificar a ambos jugadores para que actualicen disponibilidad
- Notificar al organizador para intervención manual
- Fallback: el organizador asigna horario manualmente

---

### Prompt base para el modelo de IA

```
Eres un asistente de scheduling para torneos de tenis y pádel.

Dados los siguientes datos:
- Jugadores de la ronda: [lista]
- Disponibilidad de cada jugador: [grilla]
- Canchas disponibles: [cantidad y horarios del club]
- Duración estimada de partido: [X minutos]
- Ventana de la ronda: [fecha_inicio] a [fecha_fin]

Tu tarea es:
1. Asignar un horario a cada partido de esta ronda
2. Maximizar la cantidad de partidos programados
3. Evitar que un jugador tenga dos partidos solapados
4. Respetar la disponibilidad declarada
5. Distribuir equitativamente el uso de canchas

Responde exclusivamente con un JSON válido siguiendo el esquema definido.
Si algún partido no puede programarse, inclúyelo en "sin_horario" con el motivo.
```

---

## Módulo 5 — Estados del Partido

```
propuesto       → El sistema asignó horario automáticamente
confirmado      → Ambos jugadores aceptaron
reprogramado    → Se modificó el horario (con nuevo slot acordado)
w.o.            → Un jugador no se presentó
jugado          → Partido completado, resultado cargado
cancelado       → Partido cancelado por el organizador
```

---

## Módulo 6 — Notificaciones

| Evento | Destinatario | Canal |
|---|---|---|
| Inscripción exitosa | Jugador | Email / Push |
| Partido programado | Ambos jugadores | Email / Push |
| Recordatorio 24hs antes | Ambos jugadores | Push |
| Sin slots comunes | Jugadores + Organizador | Email / Push |
| Resultado cargado | Ambos jugadores | Push |
| Avance de ronda | Jugador ganador | Push |

---

## Módulo 7 — Panel del Organizador

El organizador puede:
- Ver todos los partidos propuestos por la IA
- Aprobar la propuesta completa de una ronda
- Editar horarios individuales antes de notificar
- Agregar canchas / modificar disponibilidad del club
- Forzar asignación manual en partidos sin slots comunes
- Ver estadísticas del torneo (inscriptos por categoría, partidos jugados, etc.)

---

## Consideraciones Técnicas

### Stack sugerido

| Capa | Tecnología sugerida |
|---|---|
| Frontend | React Native (iOS + Android) o React (web) |
| Backend | Node.js / Python (FastAPI) |
| Base de datos | PostgreSQL |
| Motor de IA | API de Claude (claude-sonnet-4-20250514) |
| Autenticación | Auth0 / Supabase Auth |
| Notificaciones | Firebase Cloud Messaging |

### Estructura de base de datos (entidades principales)

```
Club → Torneo → Categoría → Inscripción → Disponibilidad
                                     ↓
                               Partido → Resultado
```

### Consideraciones de escalabilidad

- La grilla de disponibilidad debe almacenarse de forma eficiente (bitmask por día o JSON comprimido)
- El matching de IA se ejecuta como job asincrónico, no en tiempo real
- Cachear la propuesta generada y permitir al organizador editarla antes de publicarla

---

## Flujo Completo — Diagrama Narrativo

```
PROFESOR
  crea torneo → define categorías y fechas → publica

JUGADOR
  ve torneo disponible → elige categoría → elige modalidad
  → completa grilla de disponibilidad → confirma inscripción

SISTEMA (cierre de inscripciones)
  → genera cruces de la primera ronda
  → llama motor de IA con disponibilidades
  → IA retorna propuesta de horarios
  → organizador revisa y aprueba
  → jugadores reciben notificación con su partido

DESPUÉS DEL PARTIDO
  → resultado cargado (organizador o jugadores)
  → sistema avanza la ronda
  → ciclo se repite para la siguiente ronda
```

---

## Próximos Pasos Sugeridos

1. **MVP:** creación de torneo + inscripción + disponibilidad manual + visualización de cuadro
2. **v1.0:** motor de IA para matching automático + notificaciones
3. **v1.5:** dobles con búsqueda de pareja + panel de estadísticas
4. **v2.0:** ranking de jugadores + historial + integración con sistemas de reserva de canchas del club

---

*Documento generado como base para desarrollo. Versión 1.0.*
