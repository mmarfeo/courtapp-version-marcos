# Checklist: Chat como pantalla principal + Login persistente

> **Objetivo:** Convertir CourtUp en una app centrada en el chat (estilo WhatsApp), con historial persistente y login que no requiera contraseña en cada apertura.
> **Alcance:** Mobile (React Native / Expo) — prioridad. Web como segunda fase.

---

## Contexto: qué existe hoy

| Aspecto | Estado actual |
|---------|--------------|
| Chat | Tab 5 de 6 en la nav inferior, abre vacío cada vez |
| Inicio | Dashboard con métricas y torneos |
| Historial de mensajes | `sessionStorage` en web, `useState` en mobile → se borra al cerrar |
| Login | Email + password **cada vez** que se abre la app |
| Session storage | `AsyncStorage` + `persistSession: true` YA configurado (ver Fase I para ajuste) |

---

## Fase I — Login persistente sin contraseña en cada apertura

> **Esta fase va primero** porque es la más impactante y en parte ya está implementada.

### Por qué el usuario tiene que loguearse cada vez (diagnóstico)

La app ya tiene `persistSession: true` y `autoRefreshToken: true` en `mobile/src/lib/supabase.ts`.
El problema es de **configuración en Supabase**, no de código. El JWT dura 1 hora y el Refresh Token dura 7 días por defecto. Cuando el refresh token vence, Supabase invalida la sesión y el usuario es redirigido al login.

---

### Alternativas (de menor a mayor complejidad)

---

#### Opción A — Extender el TTL del Refresh Token en Supabase *(Recomendada para empezar)*

**Cómo funciona:**
Supabase guarda el JWT + Refresh Token en `AsyncStorage`. El JWT vence cada 1h pero se renueva automáticamente en segundo plano usando el Refresh Token. Si el Refresh Token también vence (por inactividad del usuario por más de 7 días), la sesión muere.

**Lo que hay que hacer:**
En el panel de Supabase: `Authentication → Configuration → Session`:
- **JWT expiry:** `3600` → `86400` (24 horas) — opcional, el autoRefresh lo maneja
- **Refresh token reuse interval:** `0` (sin reúso innecesario)
- **Session time-to-live (days):** `7` → `365` (o el valor máximo permitido)

**Resultado:** El usuario se loguea UNA sola vez. La sesión se mantiene hasta 1 año de inactividad. Exactamente como WhatsApp.

**Ventajas:** Sin código. Seguro (el token se renueva). Ya funciona con el código existente.

**Desventajas:** Si alguien roba el dispositivo y tiene acceso al teléfono desbloqueado, puede entrar sin contraseña. Riesgo bajo para esta app.

**Archivos a tocar:** Ninguno. Solo configuración en el dashboard de Supabase.

---

#### Opción B — Autenticación biométrica *(Recomendada para mediano plazo)* — ⏸ NO SE IMPLEMENTA POR AHORA

**Cómo funciona:**
La primera vez el usuario ingresa con email + password. La app guarda las credenciales encriptadas en `expo-secure-store` (almacenamiento seguro del sistema operativo, no accesible sin desbloqueo biométrico). En cada apertura posterior, la app pide Face ID o huella y restaura la sesión automáticamente.

**Lo que hay que hacer:**
- [ ] **I-B.1** Instalar dependencias: `expo-local-authentication`, `expo-secure-store`
- [ ] **I-B.2** En `mobile/src/app/auth/login.tsx`: al hacer login exitoso, ofrecer guardar credenciales con biometría
- [ ] **I-B.3** En `mobile/src/app/_layout.tsx`: al iniciar, si hay sesión vencida y credenciales guardadas → pedir biometría → hacer `signInWithPassword` automático → redirigir al home
- [ ] **I-B.4** En perfil: opción para revocar credenciales guardadas ("Desactivar ingreso biométrico")

**Resultado:** Apertura de app = Face ID / huella (0.5 segundos). Sin contraseña. Si alguien roba el teléfono, no puede entrar sin la biometría del dueño.

**Ventajas:** Muy seguro. UX premium. Familiar para el usuario (igual que banking apps).

**Desventajas:** Requiere código nuevo (~150 líneas). No funciona en dispositivos sin biometría (fallback a contraseña).

---

#### Opción C — OTP por SMS o Email *(Más similar a WhatsApp)* — ⏸ NO SE IMPLEMENTA POR AHORA

**Cómo funciona:**
El usuario se registra con su número de teléfono (o email). Para ingresar por primera vez recibe un código de 6 dígitos por SMS. La sesión luego persiste (igual que Opción A). No hay contraseña.

**Lo que hay que hacer:**
- [ ] **I-C.1** Habilitar "Phone Auth" en Supabase (requiere proveedor SMS: Twilio, Vonage, etc. — tienen costo)
- [ ] **I-C.2** Rediseñar `mobile/src/app/auth/login.tsx` para pedir número de teléfono → OTP
- [ ] **I-C.3** Adaptar `mobile/src/hooks/use-auth.tsx` para `signInWithOtp` en lugar de `signInWithPassword`
- [ ] **I-C.4** Migrar usuarios existentes (que tienen email + password) a tener teléfono asociado

**Ventajas:** UX idéntica a WhatsApp. Sin contraseñas que recordar jamás.

**Desventajas:** Costo de SMS (aprox. $0.01-0.05 por mensaje). Requiere cambio mayor en auth. Necesita número de teléfono válido de cada usuario.

---

### Orden recomendado

```
AHORA → Opción A (5 minutos, sin código, resuelve el problema)
MES 1 → Opción B (añade seguridad biométrica encima de A)
FUTURO → Opción C (si se quiere eliminar contraseñas completamente)
```

- [x] **I.1** Configurar Session TTL en Supabase Dashboard → 365 días *(Opción A — hacer primero)*
- [x] **I.2** Verificar que al cerrar y abrir la app el usuario queda logueado sin pedir contraseña
- [ ] **I.3** *(Postergado — Opción B)* Implementar biometría con `expo-local-authentication`

---

## Fase II — Chat como pantalla principal (Home)

> Reestructurar la navegación para que el chat sea lo primero que ve el usuario.

### II.A Cambio de nombres y orden de tabs

- [x] **II.A.1** Renombrar tab "Inicio" → "Dashboard" y su archivo `inicio.tsx` → `dashboard.tsx`
  - Actualizar `mobile/src/app/(jugador)/_layout.tsx`: cambiar `name="inicio"` → `name="dashboard"`
  - Renombrar el archivo físico `inicio.tsx` → `dashboard.tsx`
  - Actualizar `mobile/src/app/_layout.tsx`: la redirección del jugador cambia de `/(jugador)/inicio` → `/(jugador)/chat`

- [x] **II.A.2** Renombrar tab "Asistente" → "Chat" y moverlo al primer lugar
  - Renombrar `asistente.tsx` → `chat.tsx`
  - En `_layout.tsx` del jugador: poner `chat` como primer `<Tabs.Screen>`

- [x] **II.A.3** Nuevo orden de tabs del jugador:
  1. **Chat** (ícono: `chatbubbles-outline`) ← primero, pantalla home
  2. Torneos
  3. Clases
  4. Alquilar
  5. Dashboard (antes "Inicio")
  6. Perfil

- [x] **II.A.4** Actualizar la redirección post-login en `_layout.tsx`:
  ```typescript
  // Antes:
  router.replace('/(jugador)/inicio');
  // Después:
  router.replace('/(jugador)/chat');
  ```

---

### II.B Rediseño del chat (estilo WhatsApp)

- [x] **II.B.1** Agregar **timestamps** a cada mensaje
  - Formato: `HH:MM` junto al mensaje (como WhatsApp)
  - Separadores de fecha: `Hoy`, `Ayer`, `Lunes 23 jun`, etc.

- [x] **II.B.2** Indicador de estado de la IA
  - Mientras la IA procesa: avatar del asistente con puntitos animados ("escribiendo...")
  - Mientras ejecuta una tool: texto pequeño bajo el header (`🔍 Buscando canchas disponibles...`)

- [x] **II.B.3** Mensaje de bienvenida solo en la primera conversación
  - Detectar con AsyncStorage si es el primer uso: `chat_first_time`
  - Primera vez: mensaje largo de bienvenida con ejemplos de preguntas
  - Siguiente apertura: retoma directamente desde el último mensaje

- [x] **II.B.4** Sugerencias de acciones rápidas (solo cuando el chat está vacío)
  - Chips tapeables como WhatsApp Business:
    - "Reservar cancha para hoy"
    - "Ver mis próximas clases"
    - "Buscar torneos abiertos"
  - Al tocar → se envían como mensaje del usuario

- [x] **II.B.5** Header del chat con información del asistente
  - Avatar del logo CourtUp
  - Nombre: "Asistente CourtUp"
  - Estado: "En línea" o "Disponible 24/7"
  - Botón de limpiar conversación (ícono de bote de basura) → solo borra local/DB

---

## Fase III — Historial persistente de chat

> Los mensajes deben sobrevivir al cierre de la app y sincronizarse entre dispositivos.

### III.A Base de datos

- [x] **III.A.1** Crear migración SQL `chat_ia_historial`:

```sql
CREATE TABLE public.chat_ia_historial (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.chat_ia_historial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario_ve_su_historial"
  ON public.chat_ia_historial
  FOR ALL
  USING (usuario_id = auth.uid());

CREATE INDEX idx_chat_historial_usuario_fecha
  ON public.chat_ia_historial(usuario_id, created_at DESC);
```

  - **Archivo a crear:** `supabase/migrations/20260630_chat_ia_historial.sql`
  - Aplicar en local: `npx supabase db reset`
  - Aplicar en producción: `npx supabase db push`

- [x] **III.A.2** Crear API endpoint para guardar mensajes: `POST /api/ai/chat-history`
  - Recibe `{ role, content }` + JWT del usuario
  - Inserta en `chat_ia_historial`
  - **Archivo a crear:** `web/src/app/api/ai/chat-history/route.ts`

- [x] **III.A.3** Crear API endpoint para leer historial: `GET /api/ai/chat-history`
  - Retorna los últimos N mensajes del usuario
  - Query param `?limit=50&before=<uuid>` para paginación infinita (cargar más al scrollear arriba)
  - **Archivo a crear:** integrar en `web/src/app/api/ai/chat-history/route.ts`

### III.B Mobile — Persistencia local y sync

- [x] **III.B.1** Al abrir el chat, cargar el historial:
  1. Primero mostrar los mensajes guardados en `AsyncStorage` (rápido, sin red)
  2. Luego sincronizar con Supabase en segundo plano (por si hubo mensajes en otro dispositivo)

- [x] **III.B.2** Al enviar/recibir un mensaje, guardarlo:
  - En `AsyncStorage` inmediatamente (offline-first)
  - En Supabase DB en segundo plano (con retry si no hay red)

- [x] **III.B.3** Límite local: guardar máximo 200 mensajes en AsyncStorage; los más antiguos solo en DB.

- [x] **III.B.4** Al scrollear hacia arriba (como WhatsApp), cargar mensajes más antiguos desde Supabase ("cargar más").

- [x] **III.B.5** Crear hook `mobile/src/hooks/use-chat-history.ts`:
  ```typescript
  // Exportar:
  // - messages: Message[]
  // - loadHistory(): Promise<void>
  // - saveMessage(role, content): Promise<void>
  // - clearHistory(): Promise<void>
  // - loadMore(): Promise<void>   ← paginación
  ```

### III.C Web — Historial persistente

- [x] **III.C.1** Reemplazar `sessionStorage` por `localStorage` en `web/src/lib/hooks/useAIChat.ts` (cambio de 1 línea, mejora inmediata)
- [x] **III.C.2** Al cargar la página, leer historial desde Supabase DB
- [x] **III.C.3** Guardar cada mensaje en Supabase DB (mismo endpoint que mobile)

---

## Fase IV — Chat como home en la Web

> Aplica si la web también necesita tener el chat como pantalla principal.

- [x] **IV.1** Reemplazar el dashboard de inicio del jugador por el chat
  - La ruta `/jugador` o `/jugador/dashboard` abre el chat
  - El asistente flotante actual (`AIAssistant.tsx`) se elimina o pasa a ser secundario

- [x] **IV.2** Agregar link al dashboard como sección secundaria en el sidebar/nav

---

## Resumen de archivos a crear/modificar

| Archivo | Acción | Fase |
|---------|--------|------|
| Supabase Dashboard → Session TTL | Configurar (sin código) | I.1 |
| `mobile/src/app/(jugador)/_layout.tsx` | Modificar — nuevo orden de tabs | II.A |
| `mobile/src/app/(jugador)/inicio.tsx` → `dashboard.tsx` | Renombrar | II.A.1 |
| `mobile/src/app/(jugador)/asistente.tsx` → `chat.tsx` | Renombrar + rediseñar | II.A.2, II.B |
| `mobile/src/app/_layout.tsx` | Modificar — nueva redirección post-login | II.A.4 |
| `supabase/migrations/20260630_chat_ia_historial.sql` | Crear | III.A.1 |
| `web/src/app/api/ai/chat-history/route.ts` | Crear | III.A.2, III.A.3 |
| `mobile/src/hooks/use-chat-history.ts` | Crear | III.B.5 |
| `mobile/src/app/(jugador)/chat.tsx` | Modificar — integrar historial + nuevo diseño | III.B.1–4, II.B |
| `web/src/lib/hooks/useAIChat.ts` | Modificar — localStorage + DB sync | III.C |

---

## Orden de implementación recomendado

```
1. Fase I.1     → Configurar TTL en Supabase (5 min, sin código, impacto inmediato)
2. Fase I.2     → Verificar que el login ya persiste
3. Fase II.A    → Reestructurar navegación (renombrar tabs, reordenar)
4. Fase III.A.1 → Crear migración de DB para historial
5. Fase III.B.5 → Crear hook use-chat-history
6. Fase III.B.1-4 → Integrar historial en el chat mobile
7. Fase II.B    → Rediseño visual del chat (timestamps, sugerencias, etc.)
8. Fase III.C   → Historial en web
9. Fase IV      → Chat como home en web
10. Fase I.3    → Biometría (opcional, para más seguridad)
```
