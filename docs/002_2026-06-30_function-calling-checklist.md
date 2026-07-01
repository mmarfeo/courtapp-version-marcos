# Checklist: Function Calling (AI Tools) — Expansión Completa

> **Objetivo:** Cubrir el 100% de las funcionalidades de la app con tools de IA, por rol de usuario.
> **Estado actual:** 7 tools implementadas (todas de lectura + 1 acción sobre clases).
> **Referencia de arquitectura:** `docs/ai-chat-plan.md`

---

## Estado actual de tools

| Tool | Tipo | Rol | Estado |
|------|------|-----|--------|
| `consultar_canchas` | Lectura | Todos | ✅ Hecho |
| `consultar_clases` | Lectura | Todos | ✅ Hecho |
| `consultar_partidos` | Lectura | Todos | ✅ Hecho |
| `consultar_reservas` | Lectura | Todos | ✅ Hecho |
| `consultar_profesores` | Lectura | Todos | ✅ Hecho |
| `consultar_mis_clases` | Lectura | Jugador | ✅ Hecho |
| `reservar_clase` | Acción | Jugador | ✅ Hecho |

---

## Fase A — Nuevos endpoints API (prerequisitos)

> Estos endpoints son necesarios antes de implementar las tools. Las tools los llamarán internamente.

- [x] **A.1** `POST /api/canchas/reservar`
  - Crea un alquiler en `alquileres_cancha` sin pasar por Mercado Pago (estado `Aprobado` directo, igual que `reservar_clase`)
  - Parámetros: `cancha_id`, `fecha`, `hora_inicio`, `hora_fin`, `es_semanal?`, `fecha_fin_recurrencia?`
  - Validar solapamiento (el trigger `check_overlapping_booking` lo hace automáticamente)
  - Calcular precio día/noche según `hora_inicio_noche` de la cancha
  - **Archivo a crear:** `web/src/app/api/canchas/reservar/route.ts`

- [x] **A.2** `POST /api/canchas/cancelar`
  - Hace UPDATE de `estado_pago = 'Rechazado'` en `alquileres_cancha`
  - Solo el dueño del alquiler puede cancelar (verificar `usuario_id` del JWT)
  - **Archivo a crear:** `web/src/app/api/canchas/cancelar/route.ts`

- [x] **A.3** `POST /api/clases/cancelar`
  - Hace UPDATE de `estado_pago = 'Rechazado'` en `reservas_clases`
  - Solo el alumno dueño de la reserva puede cancelar
  - **Archivo a crear:** `web/src/app/api/clases/cancelar/route.ts`

- [x] **A.4** `POST /api/torneos/inscribir`
  - Crea fila en `inscripciones_torneo`
  - Parámetros: `torneo_id`, `modalidad` (Single/Dobles), `pareja_email?` (para dobles)
  - **Archivo a crear:** `web/src/app/api/torneos/inscribir/route.ts`

- [x] **A.5** `POST /api/torneos/cancelar-inscripcion`
  - UPDATE o DELETE en `inscripciones_torneo`
  - **Archivo a crear:** `web/src/app/api/torneos/cancelar-inscripcion/route.ts`

- [x] **A.6** `POST /api/clases/crear` (solo Profesor)
  - INSERT en `clases_disponibles`
  - Verificar que el JWT es de un usuario con rol `Profesor`
  - Parámetros: `cancha_id`, `fecha`, `hora_inicio`, `hora_fin`, `categoria_target`, `precio_clase`, `cupo_maximo`, `deporte`
  - **Archivo a crear:** `web/src/app/api/clases/crear/route.ts`

- [x] **A.7** `POST /api/clases/cancelar-clase` (solo Profesor/Organizador)
  - UPDATE `activa = false` en `clases_disponibles`
  - Notificar a los alumnos inscriptos (usar tabla `notificaciones_pendientes`)
  - **Archivo a crear:** `web/src/app/api/clases/cancelar-clase/route.ts`

---

## Fase B — Nuevas tools para Jugador

> Agregar a `web/src/lib/supabase-tools.ts`

- [x] **B.1** `buscar_canchas_disponibles`
  - Consulta `canchas` y cruza contra `alquileres_cancha` para mostrar qué canchas están LIBRES en un rango horario
  - Parámetros: `fecha`, `hora_inicio`, `hora_fin`, `deporte?`
  - **Diferencia con `consultar_reservas`:** esa muestra lo ocupado; esta muestra lo disponible

- [x] **B.2** `crear_reserva_cancha`
  - Llama al endpoint `POST /api/canchas/reservar`
  - Parámetros: `cancha_id`, `fecha`, `hora_inicio`, `hora_fin`, `es_semanal?`, `fecha_fin_recurrencia?`
  - Si es recurrente, la IA debe confirmar el rango con el usuario antes de ejecutar
  - Requiere `userToken`

- [x] **B.3** `cancelar_reserva_cancha`
  - Llama a `POST /api/canchas/cancelar`
  - Parámetros: `alquiler_id`
  - **Regla en system prompt:** siempre pedir confirmación explícita antes de ejecutar
  - Requiere `userToken`

- [x] **B.4** `listar_mis_reservas_cancha`
  - SELECT en `alquileres_cancha` filtrando por `usuario_id` del JWT
  - Parámetros: `fecha_desde?`, `fecha_hasta?`, `solo_activas?` (estado Aprobado/Pendiente)
  - Requiere `userToken`

- [x] **B.5** `buscar_torneos`
  - SELECT en `torneos` con join a `tarifas_torneo`
  - Parámetros: `deporte?`, `categoria?`, `estado?` (abierto/en_curso/finalizado)

- [x] **B.6** `inscribir_torneo`
  - Llama a `POST /api/torneos/inscribir`
  - Parámetros: `torneo_id`, `modalidad`, `pareja_email?`
  - Requiere `userToken`

- [x] **B.7** `cancelar_inscripcion_torneo`
  - Llama a `POST /api/torneos/cancelar-inscripcion`
  - Parámetros: `torneo_id`
  - Requiere `userToken`

- [x] **B.8** `ver_mis_partidos`
  - SELECT en `partidos` donde el usuario es jugador1 o jugador2
  - Parámetros: `torneo_id?`, `estado?`
  - Requiere `userToken`

- [x] **B.9** `cancelar_reserva_clase`
  - Llama a `POST /api/clases/cancelar`
  - Parámetros: `reserva_clase_id`
  - Requiere `userToken`

---

## Fase C — Nuevas tools para Profesor

> Agregar a `web/src/lib/supabase-tools.ts`

- [x] **C.1** `crear_clase`
  - Llama a `POST /api/clases/crear`
  - Parámetros: `cancha_id`, `fecha`, `hora_inicio`, `hora_fin`, `categoria_target`, `precio_clase`, `cupo_maximo`, `deporte`
  - La IA debe verificar disponibilidad de cancha antes con `buscar_canchas_disponibles`
  - Requiere `userToken`

- [x] **C.2** `listar_mis_clases_como_profesor`
  - SELECT en `clases_disponibles` donde `profesor_id` = usuario del JWT
  - Parámetros: `fecha_desde?`, `fecha_hasta?`, `activa?`
  - Requiere `userToken`

- [x] **C.3** `ver_alumnos_clase`
  - SELECT en `reservas_clases` JOIN `perfiles_usuarios` donde `clase_id` = parámetro
  - Parámetros: `clase_id`
  - El RLS ya garantiza que el profesor solo ve reservas de sus propias clases
  - Requiere `userToken`

- [x] **C.4** `cancelar_clase`
  - Llama a `POST /api/clases/cancelar-clase`
  - Parámetros: `clase_id`
  - Requiere `userToken`

- [x] **C.5** `ver_mis_alquileres_como_profesor`
  - SELECT en `alquileres_cancha` donde `usuario_id` del JWT y `rol = 'Profesor'`
  - Útil para que el profesor vea sus canchas reservadas para dar clases
  - Parámetros: `fecha_desde?`, `fecha_hasta?`
  - Requiere `userToken`

---

## Fase D — Nuevas tools para Organizador

> Agregar a `web/src/lib/supabase-tools.ts`

- [x] **D.1** `listar_todos_los_torneos`
  - SELECT en `torneos` con join a `inscripciones_torneo` (COUNT de inscriptos)
  - Parámetros: `estado?`, `deporte?`

- [x] **D.2** `listar_inscripciones_torneo`
  - SELECT en `inscripciones_torneo` JOIN `perfiles_usuarios` para un torneo dado
  - Parámetros: `torneo_id`

- [x] **D.3** `consultar_disponibilidad_cancha`
  - SELECT en `alquileres_cancha` y `clases_disponibles` para una cancha y rango de fechas
  - Muestra el calendario de ocupación
  - Parámetros: `cancha_id`, `fecha_desde`, `fecha_hasta`

- [x] **D.4** `listar_todos_alquileres`
  - SELECT en `alquileres_cancha` JOIN `perfiles_usuarios` (nombre del usuario)
  - Parámetros: `fecha_desde?`, `fecha_hasta?`, `cancha_id?`, `estado_pago?`

- [x] **D.5** `listar_profesores_y_deudas`
  - SELECT en `perfiles_usuarios` donde `rol = 'Profesor'` con JOIN a `alquileres_cancha`
  - Calcula deuda acumulada de cada profesor con el club
  - **Nota:** Requiere definir bien la lógica de deuda (precio horario × horas usadas − pagos)

- [x] **D.6** `ver_pagos_pendientes`
  - SELECT en `alquileres_cancha` y `reservas_clases` donde `estado_pago = 'Pendiente'`
  - Parámetros: `tipo?` (alquiler/clase/torneo)

---

## Fase E — Mejoras al sistema existente

- [x] **E.1** Agregar contexto de rol al system prompt en `web/src/app/api/ai/chat/route.ts`
  - Actualmente hay un único system prompt genérico
  - Leer el rol del usuario desde el JWT y construir prompts diferenciados por rol (Jugador / Profesor / Organizador)
  - Cada rol debe ver solo las tools que le corresponden (no enviar todas las tools a todos los roles)

- [x] **E.2** Filtrar tools por rol antes de llamar a Gemini/Ollama
  - Crear grupos de tools: `TOOLS_JUGADOR`, `TOOLS_PROFESOR`, `TOOLS_ORGANIZADOR`
  - Pasar solo el subset correcto al modelo según el rol del usuario
  - **Archivo:** `web/src/lib/supabase-tools.ts`

- [x] **E.3** Mejorar `consultar_reservas` para mostrar disponibilidad, no solo ocupación
  - Actualmente solo muestra las reservas existentes
  - Complementar con las canchas que NO tienen reserva en ese horario

- [x] **E.4** Agregar `userToken` al system prompt para tools que requieren autenticación
  - Actualmente `userToken` llega al endpoint pero no se loguea si falta
  - Agregar validación temprana y mensaje de error claro si el usuario no está logueado

- [x] **E.5** Agregar regla en el system prompt: confirmar antes de acciones destructivas
  - Cancelaciones y reservas recurrentes deben pedir confirmación explícita
  - Ej: "¿Confirmás que querés cancelar la reserva del lunes 7 a las 18hs?"

---

## Fase F — Integración Mobile

- [x] **F.1** Crear `mobile/src/services/botActions.ts`
  - Funciones puras que usan el cliente Supabase de mobile directamente (sin pasar por Next.js)
  - Exportar: `buscarCanchasDisponibles()`, `crearReservaCancha()`, `cancelarReservaCancha()`, `listarMisReservas()`, `buscarTorneos()`, `inscribirTorneo()`
  - Usar el cliente `supabase` de `mobile/src/lib/supabase.ts` (que ya tiene la sesión del usuario)

- [x] **F.2** Crear pantalla de chat en mobile `mobile/src/app/(jugador)/asistente.tsx`
  - Consumir el mismo endpoint `/api/ai/chat` de la web (o adaptar uno para mobile)
  - Usar `KeyboardAvoidingView` + `FlatList` + `TextInput`

- [x] **F.3** Agregar ítem "Asistente" a la navegación inferior del mobile

---

## Fase G — Tests

- [x] **G.1** Flujo completo Jugador: buscar cancha disponible → reservar → confirmar reserva
- [x] **G.2** Flujo completo Jugador: reserva recurrente ("de lunes a viernes de 14 a 22hs hasta diciembre")
- [x] **G.3** Flujo completo Jugador: cancelar reserva de cancha
- [x] **G.4** Flujo completo Jugador: inscribirse a torneo → ver partidos
- [x] **G.5** Flujo completo Profesor: crear clase → ver alumnos inscriptos → cancelar clase
- [x] **G.6** Flujo completo Organizador: ver inscripciones torneo → pagos pendientes
- [x] **G.7** Verificar que RLS bloquea a un Jugador ejecutando tools de Organizador
- [x] **G.8** Verificar que el trigger `check_overlapping_booking` rechaza reservas solapadas
- [x] **G.9** Probar flujos con Gemini y con Ollama (fallback)

---

## Resumen de archivos a crear/modificar

| Archivo | Acción | Fase |
|---------|--------|------|
| `web/src/app/api/canchas/reservar/route.ts` | Crear | A.1 |
| `web/src/app/api/canchas/cancelar/route.ts` | Crear | A.2 |
| `web/src/app/api/clases/cancelar/route.ts` | Crear | A.3 |
| `web/src/app/api/torneos/inscribir/route.ts` | Crear | A.4 |
| `web/src/app/api/torneos/cancelar-inscripcion/route.ts` | Crear | A.5 |
| `web/src/app/api/clases/crear/route.ts` | Crear | A.6 |
| `web/src/app/api/clases/cancelar-clase/route.ts` | Crear | A.7 |
| `web/src/lib/supabase-tools.ts` | Modificar — agregar 16 tools nuevas | B, C, D, E.2 |
| `web/src/app/api/ai/chat/route.ts` | Modificar — system prompt por rol | E.1, E.4, E.5 |
| `mobile/src/services/botActions.ts` | Crear | F.1 |
| `mobile/src/app/(jugador)/asistente.tsx` | Crear | F.2 |

---

## Orden de implementación recomendado

1. **Primero Fase A** (endpoints) — son prerequisitos de todo lo demás
2. **Luego Fase B** (tools de Jugador) — mayor impacto en el usuario final
3. **Luego Fase E** (mejoras al sistema) — contexto de rol
4. **Luego Fase C** (tools de Profesor)
5. **Luego Fase D** (tools de Organizador)
6. **Luego Fase F** (mobile) — depende de que la web esté estable
7. **Finalmente Fase G** (tests)
