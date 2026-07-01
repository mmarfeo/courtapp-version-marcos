# Checklist 004 — Chat para SuperAdmin, Profesor y Organizador

> **Objetivo:** Extender el chat estilo WhatsApp a los tres roles restantes, con AI tools que cubran el 100% de las acciones disponibles en la UI de cada rol.
> **Base:** El rol Jugador ya tiene chat completo (`/jugador/chat`). Replicar ese patrón para los demás roles y crear las tools/endpoints faltantes.
> **Fecha:** 2026-07-01

---

## Inventario de funcionalidades por rol

### PROFESOR — Acciones en la UI hoy

| Pantalla | Acciones disponibles |
|----------|---------------------|
| `/profesor/agenda` | Ver calendario semanal de clases, crear clase rápida, editar clase, ver alumnos inscriptos, cancelar clase, configurar horario de trabajo |
| `/profesor/dashboard` | Ver ganancias del mes, % ocupación, alumnos activos, clases vacías, deuda total con el club |
| `/profesor/clases/nueva` | Crear clase con deporte, categoría, cancha, fecha, hora, cupo, precio, opción semanal |
| `/profesor/reservar` | Reservar cancha (única, fija semanal, días específicos), con cálculo automático de precio diurno/nocturno |
| `/profesor/pagos` | Ver/editar CVU, alias, CUIT, banco, vinculación MercadoPago |

**Tools ya existentes para Profesor:** `buscar_canchas_disponibles`, `crear_clase`, `listar_mis_clases_como_profesor`, `ver_alumnos_clase`, `cancelar_clase`, `ver_mis_alquileres_como_profesor`, `consultar_canchas`, `consultar_profesores`

**Tools faltantes para Profesor:**
- `crear_reserva_cancha` — reservar cancha (hoy solo disponible para Jugador)
- `cancelar_reserva_cancha` — cancelar reserva propia de cancha
- `editar_clase` — modificar deporte/precio/cupo/hora de una clase existente
- `ver_mis_ingresos` — resumen de ganancias del mes (clases + alquileres)
- `ver_mi_deuda` — deuda propia con el club (alquileres impagos)

---

### ORGANIZADOR — Acciones en la UI hoy

| Pantalla | Acciones disponibles |
|----------|---------------------|
| `/organizador/canchas` (tab Gestión) | Crear cancha, editar cancha (deporte, superficie, precios diurnos/nocturnos, precio profesor, hora inicio noche), activar/desactivar |
| `/organizador/canchas` (tab Status) | Ver ocupación en tiempo real, ver alquileres y clases por cancha |
| `/organizador/torneos/nuevo` | Crear torneo: nombre, deporte, categorías, precios (single/dobles/ambos), club, fecha, sets, reglas de zonas |
| `/organizador/torneos/editar/[id]` | Ver inscriptos, gestionar partidos: asignar fecha/hora/cancha, registrar resultados (sets 1-2-3), cambiar estado del partido |
| `/admin/torneos-dashboard` | Ver estadísticas de torneos, filtrar por mes/deporte |
| `/organizador/torneos` | Listar torneos con conteo de inscriptos |

**Tools ya existentes para Organizador:** `listar_todos_los_torneos`, `listar_inscripciones_torneo`, `consultar_disponibilidad_cancha`, `listar_todos_alquileres`, `listar_profesores_y_deudas`, `ver_pagos_pendientes`, `consultar_clases`, `consultar_canchas`, `consultar_profesores`

**Tools faltantes para Organizador:**
- `crear_torneo` — crear torneo completo con tarifas en una sola operación
- `cambiar_fase_torneo` — avanzar fase: Inscripcion → Zonas → Semifinal → Final → Terminado
- `listar_partidos_torneo` — ver partidos de un torneo con estado y resultados
- `asignar_partido` — asignar fecha, hora y cancha a un partido
- `registrar_resultado` — cargar set1/set2/set3 y ganador de un partido
- `crear_cancha` — crear nueva cancha con precios y configuración
- `editar_cancha` — modificar precios, superficie, horarios de una cancha
- `cancelar_reserva_organizador` — cancelar cualquier alquiler de cancha del club
- `cancelar_clase_organizador` — cancelar cualquier clase del club (notifica alumnos)

---

### SUPERADMIN — Acciones en la UI hoy

| Pantalla | Acciones disponibles |
|----------|---------------------|
| `/admin/dashboard` | Ver métricas totales (usuarios, torneos, inscriptos, clases, alquileres), gestionar staff (ver, editar, eliminar miembros de la org) |
| `/admin/deudas` | Ver deudas de profesores agrupadas por profesor, filtrar por club |
| `/admin/torneos-dashboard` | Estadísticas de todos los torneos, filtrar por mes/deporte/búsqueda |
| `/admin/clubes/nuevo` | Crear club con nombre, slug y credenciales MercadoPago |
| `/admin/clubes/editar/[id]` | Editar nombre, slug y credenciales MP de un club |
| `/admin/staff/nuevo` | Crear usuario staff: nombre, email, password, roles, clubes asignados |
| `/admin/logs` | Stream de logs del servidor en tiempo real |

**Tools existentes para SuperAdmin:** (hereda las del Organizador, ya que comparte menú)

**Tools faltantes para SuperAdmin:**
- `ver_estadisticas_sistema` — métricas globales (total usuarios, clubes, ingresos del mes, partidos pendientes)
- `ver_deudas_profesores` — resumen de deudas de staff agrupado por profesor y club
- `listar_clubes` — listar organizaciones registradas con estado
- `listar_staff_club` — listar miembros de staff de un club con sus roles
- `cambiar_fase_torneo` — avanzar fase de cualquier torneo (compartida con Organizador)
- `listar_partidos_torneo` — ver partidos (compartida con Organizador)
- `asignar_partido` — asignar fecha/hora/cancha a un partido (compartida)
- `registrar_resultado` — cargar resultado de partido (compartida)

---

## Fase A — Páginas de chat por rol en la web

- [ ] **A.1** Crear `/profesor/chat/page.tsx` — copiar estructura de `/jugador/chat/page.tsx`, adaptar quick actions para Profesor
- [ ] **A.2** Crear `/organizador/chat/page.tsx` — copiar estructura, adaptar quick actions para Organizador
- [ ] **A.3** Crear `/admin/chat/page.tsx` — copiar estructura, adaptar quick actions para SuperAdmin
- [ ] **A.4** Agregar "Chat" como primer ítem en el Sidebar para rol `Profesor`
- [ ] **A.5** Agregar "Chat" como primer ítem en el Sidebar para rol `Organizador`
- [ ] **A.6** Agregar "Chat" como primer ítem en el Sidebar para rol `SuperAdmin`
- [ ] **A.7** Crear `/profesor/page.tsx` → redirect a `/profesor/chat`
- [ ] **A.8** Crear `/organizador/page.tsx` → redirect a `/organizador/chat` (si no existe)
- [ ] **A.9** Actualizar `handleRoleSwitch` en Sidebar: Profesor → `/profesor/chat`, Organizador → `/organizador/chat`

---

## Fase B — Nuevos API endpoints

> Endpoints necesarios para soportar las tools de escritura nuevas.

### B.1 Profesor
- [ ] **B.1.1** `POST /api/clases/editar` — editar clase existente (deporte, precio, cupo, hora). Verifica que el JWT sea el profesor dueño de la clase.
- [ ] **B.1.2** `GET /api/profesor/ingresos` — retorna suma de `reservas_clases.monto_total_pagado` + `alquileres_cancha.monto_total` del mes actual para el profesor autenticado.
- [ ] **B.1.3** `GET /api/profesor/deuda` — retorna `alquileres_cancha` donde `estado_pago = 'Pendiente'` del profesor autenticado.

### B.2 Organizador
- [ ] **B.2.1** `POST /api/torneos/crear` — crea registro en `torneos` + registros en `tarifas_torneo` (precio_single, precio_dobles, precio_ambos). Verifica rol Organizador/SuperAdmin.
- [ ] **B.2.2** `POST /api/torneos/cambiar-fase` — recibe `{ torneo_id, nueva_fase }` y hace UPDATE en `torneos.fase_actual`. Valida que la fase sea válida (Inscripcion → Zonas → Cuartos → Semifinal → Final → Terminado).
- [ ] **B.2.3** `GET /api/torneos/[id]/partidos` — lista partidos de un torneo con estado, resultado, jugadores y cancha asignada.
- [ ] **B.2.4** `POST /api/partidos/asignar` — recibe `{ partido_id, fecha, hora, cancha_id }` y actualiza el partido.
- [ ] **B.2.5** `POST /api/partidos/resultado` — recibe `{ partido_id, set1, set2, set3, ganador_pareja }` y registra resultado. Cambia estado a `jugado`.
- [ ] **B.2.6** `POST /api/canchas/crear` — crea una cancha en el club del organizador autenticado.
- [ ] **B.2.7** `POST /api/canchas/editar` — actualiza precios, superficie y horarios de una cancha. Verifica que la cancha pertenezca al club del organizador.

### B.3 SuperAdmin
- [ ] **B.3.1** `GET /api/admin/estadisticas` — métricas globales: total clubes, usuarios, torneos activos, alquileres del mes, ingresos totales del mes.
- [ ] **B.3.2** `GET /api/admin/deudas` — lista de profesores con deuda pendiente, agrupada por club.
- [ ] **B.3.3** `GET /api/admin/clubes` — lista de organizaciones con nombre, slug y estado.
- [ ] **B.3.4** `GET /api/admin/staff` — lista de miembros de staff filtrable por club, con roles.

---

## Fase C — Nuevos AI tools para Profesor

> Agregar en `web/src/lib/supabase-tools.ts` dentro de `TOOLS_PROFESOR`.

- [ ] **C.1** `crear_reserva_cancha` — igual que en TOOLS_JUGADOR: buscar cancha disponible y crear alquiler. (El Profesor ya puede reservar canchas en la UI.)
- [ ] **C.2** `cancelar_reserva_cancha` — cancelar alquiler propio. (Compartir lógica con TOOLS_JUGADOR.)
- [ ] **C.3** `editar_clase` — modificar clase existente del profesor.
  ```json
  { "clase_id": "uuid", "precio": 1500, "cupo": 6, "hora_inicio": "09:00" }
  ```
  Llama a `POST /api/clases/editar`.
- [ ] **C.4** `ver_mis_ingresos` — obtener resumen de ingresos del mes. Llama a `GET /api/profesor/ingresos`. Sin parámetros.
- [ ] **C.5** `ver_mi_deuda` — obtener alquileres pendientes de pago. Llama a `GET /api/profesor/deuda`. Sin parámetros.

---

## Fase D — Nuevos AI tools para Organizador

> Agregar en `web/src/lib/supabase-tools.ts` dentro de `TOOLS_ORGANIZADOR`.

- [ ] **D.1** `crear_torneo` — crear torneo completo.
  ```json
  { "nombre_torneo": "string", "deporte": "Tenis|Padel", "categorias": ["A","B"], "precio_single": 5000, "precio_dobles": 8000, "fecha_inicio": "2026-08-01", "formato_sets": 3 }
  ```
  Llama a `POST /api/torneos/crear`.
- [ ] **D.2** `cambiar_fase_torneo` — avanzar o cambiar la fase de inscripción.
  ```json
  { "torneo_id": "uuid", "nueva_fase": "Inscripcion|Zonas|Cuartos|Semifinal|Final|Terminado" }
  ```
  Llama a `POST /api/torneos/cambiar-fase`.
- [ ] **D.3** `listar_partidos_torneo` — listar partidos de un torneo.
  ```json
  { "torneo_id": "uuid", "estado": "pendiente|jugado|todos" }
  ```
  Llama a `GET /api/torneos/[id]/partidos`.
- [ ] **D.4** `asignar_partido` — asignar fecha, hora y cancha a un partido.
  ```json
  { "partido_id": "uuid", "fecha": "2026-08-10", "hora": "18:00", "cancha_id": "uuid" }
  ```
  Llama a `POST /api/partidos/asignar`.
- [ ] **D.5** `registrar_resultado` — cargar resultado de un partido jugado.
  ```json
  { "partido_id": "uuid", "resultado_set1": "6-4", "resultado_set2": "7-5", "resultado_set3": null, "ganador_pareja": 1 }
  ```
  Llama a `POST /api/partidos/resultado`.
- [ ] **D.6** `crear_cancha` — crear nueva cancha en el club.
  ```json
  { "numero_cancha": 5, "deporte": "Padel", "superficie": "Cristal", "precio_hora_dia": 3000, "precio_hora_noche": 4000 }
  ```
  Llama a `POST /api/canchas/crear`.
- [ ] **D.7** `editar_cancha` — modificar configuración de una cancha.
  ```json
  { "cancha_id": "uuid", "precio_hora_dia": 3500, "precio_hora_noche": 4500, "precio_profesor_hora_dia": 1500 }
  ```
  Llama a `POST /api/canchas/editar`.
- [ ] **D.8** `cancelar_reserva_organizador` — cancelar cualquier alquiler del club.
  ```json
  { "alquiler_id": "uuid", "motivo": "string" }
  ```
  Llama a `POST /api/canchas/cancelar` (mismo endpoint, el org puede cancelar cualquiera).
- [ ] **D.9** `cancelar_clase_organizador` — cancelar cualquier clase del club y notificar alumnos.
  ```json
  { "clase_id": "uuid", "motivo": "string" }
  ```
  Llama a `POST /api/clases/cancelar-clase` (ya existe, ya soporta Organizador).

---

## Fase E — Nuevos AI tools para SuperAdmin

> Crear `TOOLS_SUPERADMIN` en `web/src/lib/supabase-tools.ts`.
> SuperAdmin hereda todas las tools del Organizador + las siguientes exclusivas.

- [ ] **E.1** `ver_estadisticas_sistema` — métricas globales del sistema. Sin parámetros. Llama a `GET /api/admin/estadisticas`.
- [ ] **E.2** `ver_deudas_profesores` — listado de profesores con deudas pendientes. Sin parámetros. Llama a `GET /api/admin/deudas`.
- [ ] **E.3** `listar_clubes` — ver todas las organizaciones registradas. Sin parámetros. Llama a `GET /api/admin/clubes`.
- [ ] **E.4** `listar_staff_club` — ver staff de un club específico.
  ```json
  { "organizacion_id": "uuid" }
  ```
  Llama a `GET /api/admin/staff?organizacion_id=<uuid>`.

---

## Fase F — Actualizar `supabase-tools.ts` y route `/api/ai/chat`

- [ ] **F.1** Agregar tools de Fase C a `TOOLS_PROFESOR` (C.1–C.5).
- [ ] **F.2** Agregar tools de Fase D a `TOOLS_ORGANIZADOR` (D.1–D.9).
- [ ] **F.3** Crear `TOOLS_SUPERADMIN = [...TOOLS_ORGANIZADOR, ...TOOLS_SUPERADMIN_EXCLUSIVAS]` con tools de Fase E.
- [ ] **F.4** Actualizar `executeToolCall` en `supabase-tools.ts` con los nuevos casos para cada nueva tool.
- [ ] **F.5** Actualizar `getToolsForRol` en `/api/ai/chat/route.ts` para incluir caso `SuperAdmin`.
- [ ] **F.6** Actualizar `buildSystemPrompt` para incluir prompt específico de SuperAdmin.

---

## Fase G — Actualizar Sidebar y navegación

- [ ] **G.1** Actualizar `handleRoleSwitch` para Profesor → `/profesor/chat` y Organizador → `/organizador/chat`.
- [ ] **G.2** Actualizar `getNavItems()` en Sidebar: agregar Chat como primer ítem en Profesor, Organizador y SuperAdmin.
- [ ] **G.3** Crear `/profesor/page.tsx` → `redirect('/profesor/chat')`.
- [ ] **G.4** Verificar si existe `/organizador/page.tsx` y agregar redirect si no.

---

## Resumen de archivos a crear/modificar

| Archivo | Acción | Fase |
|---------|--------|------|
| `web/src/app/profesor/chat/page.tsx` | Crear | A.1 |
| `web/src/app/organizador/chat/page.tsx` | Crear | A.2 |
| `web/src/app/admin/chat/page.tsx` | Crear | A.3 |
| `web/src/app/profesor/page.tsx` | Crear (redirect) | A.7 |
| `web/src/app/organizador/page.tsx` | Crear (redirect) | A.8 |
| `web/src/app/api/clases/editar/route.ts` | Crear | B.1.1 |
| `web/src/app/api/profesor/ingresos/route.ts` | Crear | B.1.2 |
| `web/src/app/api/profesor/deuda/route.ts` | Crear | B.1.3 |
| `web/src/app/api/torneos/crear/route.ts` | Crear | B.2.1 |
| `web/src/app/api/torneos/cambiar-fase/route.ts` | Crear | B.2.2 |
| `web/src/app/api/torneos/[id]/partidos/route.ts` | Crear | B.2.3 |
| `web/src/app/api/partidos/asignar/route.ts` | Crear | B.2.4 |
| `web/src/app/api/partidos/resultado/route.ts` | Crear | B.2.5 |
| `web/src/app/api/canchas/crear/route.ts` | Crear | B.2.6 |
| `web/src/app/api/canchas/editar/route.ts` | Crear | B.2.7 |
| `web/src/app/api/admin/estadisticas/route.ts` | Crear | B.3.1 |
| `web/src/app/api/admin/deudas/route.ts` | Crear | B.3.2 |
| `web/src/app/api/admin/clubes/route.ts` | Crear | B.3.3 |
| `web/src/app/api/admin/staff/route.ts` | Crear | B.3.4 |
| `web/src/lib/supabase-tools.ts` | Modificar | F.1–F.4 |
| `web/src/app/api/ai/chat/route.ts` | Modificar | F.5–F.6 |
| `web/src/components/Sidebar.tsx` | Modificar | G.1–G.2 |

---

## Quick actions sugeridas por rol

### Profesor
1. "¿Cuánto gané este mes?"
2. "Crear clase de Tenis para mañana a las 10hs"
3. "Ver mis clases de esta semana"
4. "¿Cuántos alumnos tengo en mis clases?"
5. "Reservar cancha para mañana a las 9hs"

### Organizador
1. "¿Cuántos inscriptos tiene el torneo actual?"
2. "Mostrarme los partidos pendientes de asignar"
3. "¿Qué canchas están disponibles hoy?"
4. "Ver los pagos pendientes de aprobación"
5. "¿Cuánto le deben los profesores al club?"

### SuperAdmin
1. "Resumen de estadísticas del sistema"
2. "¿Qué profesores tienen deuda pendiente?"
3. "Mostrarme todos los clubes registrados"
4. "Ver staff del club principal"
5. "Listar torneos activos con inscriptos"

---

## Orden de implementación recomendado

```
1. Fase A     → Páginas de chat por rol + Sidebar (sin tools, el chat funciona igual)
2. Fase G     → Navegación y redirects
3. Fase B.1   → Endpoints Profesor (3 nuevos)
4. Fase C     → Tools Profesor (5 nuevas)
5. Fase B.2   → Endpoints Organizador (7 nuevos)
6. Fase D     → Tools Organizador (9 nuevas)
7. Fase B.3   → Endpoints SuperAdmin (4 nuevos)
8. Fase E     → Tools SuperAdmin (4 nuevas)
9. Fase F     → Integrar todo en supabase-tools.ts y route chat
```

**Total nuevos archivos:** 20
**Total tools nuevas:** C(5) + D(9) + E(4) = **18 tools nuevas**
**Total endpoints nuevos:** B.1(3) + B.2(7) + B.3(4) = **14 endpoints nuevos**
