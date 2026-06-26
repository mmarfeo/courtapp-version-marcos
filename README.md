# 🏟️ CourtUp — Plataforma SaaS de Gestión Deportiva con IA

<div align="center">

**Gestión inteligente de Torneos, Canchas y Clases de Tenis/Pádel**

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Deno](https://img.shields.io/badge/Edge_Functions-Deno-000000?logo=deno)](https://deno.land/)
[![Mercado Pago](https://img.shields.io/badge/Pagos-Mercado_Pago-009EE3)](https://www.mercadopago.com.ar/)

</div>

---

## 📋 Descripción

**CourtUp** es una plataforma SaaS (Software as a Service) de alto rendimiento diseñada para que **Clubes Deportivos** gestionen de forma integral:

- 🏆 **Torneos** con bracket automatizado mediante IA (Seeding + Matchmaking Horario)
- 🏟️ **Alquiler de Canchas** con disponibilidad en tiempo real
- 📚 **Escuelas de Clases** particulares o grupales segmentadas por nivel
- 💬 **Chat en Tiempo Real** entre rivales por partido
- 💳 **Cobros Automáticos** con split de pagos vía Mercado Pago Marketplace

El modelo de negocio retiene una **comisión fija por transacción** (`PLATFORM_FEE_ARS`) mediante split automático de pagos.

---

## 🏗️ Arquitectura

```
┌────────────────────────────────────────────────────────────────┐
│                        CLIENTES                                │
│   Next.js 14 (Web)  ←──→  React Native + Expo (Mobile)        │
└────────────────┬───────────────────────────┬───────────────────┘
                 │ REST / Realtime WS        │ Push Notifications
┌────────────────▼───────────────────────────▼───────────────────┐
│                     SUPABASE PLATFORM                          │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │  Auth + JWT  │  │   Realtime   │  │   Edge Functions      │ │
│  │  Custom      │  │   WebSocket  │  │   (Deno Runtime)      │ │
│  │  Claims      │  │   Channels   │  │   • checkout MP       │ │
│  └──────┬──────┘  └──────┬───────┘  │   • webhook MP        │ │
│         │                │          │   • generate-bracket   │ │
│  ┌──────▼────────────────▼──────┐   │   • get-platform-fee   │ │
│  │      PostgreSQL 15           │   └───────────────────────┘ │
│  │  • RLS Multi-Tenant          │                              │
│  │  • Triggers Automáticos      │                              │
│  │  • ENUMs Tipados             │                              │
│  └──────────────────────────────┘                              │
└────────────────────────────────────────────────────────────────┘
```

---

## 👥 Roles del Sistema

| Rol | Acceso | Permisos |
|-----|--------|----------|
| **Jugador / Alumno** | App Móvil | Inscribirse en torneos, alquilar canchas, reservar clases de su nivel, chatear con rivales |
| **Profesor** | Web / Móvil | Publicar bloques horarios, revisar agenda diaria con alumnos confirmados |
| **Organizador** | Web | Gestionar canchas, crear torneos, dar de alta profesores, ver métricas financieras |
| **SuperAdmin** | Web | Acceso cross-tenant de solo lectura, suspender/reactivar clubes, auditar pagos |

---

## 🎾 Categorías Deportivas

Todos los usuarios y eventos se segmentan bajo esta escala jerárquica oficial:

`SuperA` → `A +` → `A` → `B+` → `B` → `C+` → `C` → `D`

---

## 🗂️ Estructura del Proyecto

```
CourtUp/
├── supabase/
│   ├── migrations/
│   │   ├── 00001_initial_schema.sql          # ENUMs y tablas core
│   │   ├── 00002_auth_trigger_and_claims.sql # Trigger auth + JWT Claims
│   │   ├── 00003_rls_policies_setup.sql      # Políticas RLS base
│   │   ├── 00004_canchas_rls.sql             # RLS Canchas + Alquileres
│   │   ├── 00005_bracket_automation.sql      # Trigger avance automático
│   │   └── 00006_chat_organizer_rls.sql      # RLS Chat + Organizador
│   ├── functions/
│   │   ├── get-platform-fee/index.ts         # Lectura segura de comisión
│   │   ├── mercadopago-checkout/index.ts     # Generación de preferencia MP
│   │   ├── mercadopago-webhook/index.ts      # Confirmación asincrónica
│   │   └── generate-bracket/index.ts         # IA Seeding + Matchmaking
│   └── seed.sql                              # Datos de prueba
│
└── web/                                       # Frontend Next.js 14
    └── src/
        ├── app/
        │   ├── page.tsx                       # Landing / Hub de navegación
        │   ├── admin/dashboard/page.tsx       # Panel SuperAdmin
        │   ├── organizador/canchas/page.tsx   # CRUD Canchas
        │   ├── profesor/
        │   │   ├── clases/nueva/page.tsx      # Publicar clase
        │   │   └── agenda/page.tsx            # Agenda del día
        │   └── jugador/torneos/[id]/
        │       └── inscripcion/page.tsx       # Flujo de inscripción + pago
        ├── components/
        │   └── PartidoChat.tsx                # Chat en tiempo real
        └── lib/
            ├── supabase.ts                    # Cliente Supabase
            ├── hooks/usePartidoChat.ts        # Hook Realtime
            └── queries/
                ├── adminQueries.ts            # Consultas SuperAdmin
                ├── canchasQueries.ts          # CRUD Canchas
                └── mobileAppQueries.ts        # Consultas App Móvil
```

---

## 🚀 Instalación y Ejecución Local

### Prerequisitos
- [Node.js](https://nodejs.org/) v20+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (para Supabase local)
- [Git](https://git-scm.com/)

### 1. Clonar el Repositorio
```bash
git clone https://github.com/NicOrtiz29/CourtUp.git
cd CourtUp
```

### 2. Levantar Supabase (Backend + Base de Datos)
```bash
npx supabase start
```
> Esto descarga las imágenes Docker, aplica las 6 migraciones SQL automáticamente y levanta PostgreSQL, Auth, Realtime y Edge Functions.

### 3. Copiar las credenciales al frontend
Crear el archivo `web/.env.local` con las credenciales que devolvió `supabase start`:
```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu_publishable_key>
```

### 4. Instalar dependencias del Frontend
```bash
cd web
pnpm install
```

### 5. Ejecutar el servidor de desarrollo
```bash
pnpm run dev
```

### 6. Abrir en el navegador
- **Frontend:** [http://localhost:3000](http://localhost:3000)
- **Supabase Studio:** [http://127.0.0.1:54323](http://127.0.0.1:54323)

### 7. (Opcional) Cargar datos de prueba
```bash
cd ..
npx supabase db reset
```
> Esto reinicia la base de datos y aplica el archivo `supabase/seed.sql` con organizaciones, canchas y torneos de ejemplo.

---

## 💰 Lógica de Comisión (Split de Pagos)

| Variable | Descripción |
|----------|-------------|
| `PLATFORM_FEE_ARS` | Comisión fija en ARS por transacción |

**Flujo:**
1. El jugador paga el precio total del torneo/clase/alquiler.
2. La Edge Function calcula: `monto_neto_club = precio - PLATFORM_FEE_ARS`.
3. Se genera una preferencia de Mercado Pago Marketplace con `application_fee`.
4. Al confirmarse el pago (webhook), se persiste el valor histórico de la comisión como snapshot inmutable.

> ⚠️ Si `PLATFORM_FEE_ARS` no está definida, todas las transacciones se abortan automáticamente.

---

## 🧠 IA Seeding y Matchmaking

### Algoritmo de Seeding
Al cerrar la fase de inscripción:
1. Se evalúa el número de inscriptos con pago aprobado.
2. Se calcula la potencia de 2 más cercana (ej: 12 inscriptos → cuadro de 16).
3. Se asignan **Byes** (pases directos) a las posiciones necesarias.
4. Se genera el árbol binario completo de partidos.

### Matchmaking Horario
- Se cruzan las `propuestas_disponibilidad` de los competidores con el inventario de `canchas` del club.
- Se asigna automáticamente fecha, hora y cancha sin intervención humana.

### Avance Automático (Trigger PostgreSQL)
- Al cargarse el resultado de un partido (`ganador_pareja`), un trigger nativo detecta el cambio y promueve automáticamente al ganador al siguiente nodo del bracket.
- Los cambios se propagan en tiempo real vía Supabase Realtime a todos los dispositivos conectados.

---

## 🔒 Seguridad (Row Level Security)

Toda la seguridad de datos se implementa a nivel de PostgreSQL (RLS):

- **Multi-Tenancy:** Un organizador solo accede a datos de su propio club.
- **Filtrado por Nivel:** Los jugadores solo ven clases que coincidan exactamente con su `categoria_deportiva`.
- **Chat Aislado:** Solo los jugadores de un partido específico (y el organizador del club) pueden leer/escribir mensajes.
- **JWT Claims:** El rol del usuario se inyecta automáticamente en el token JWT para validaciones sin latencia.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **Backend & DB** | Supabase (PostgreSQL 15, Auth, Realtime, Edge Functions) |
| **Frontend Web** | Next.js 14 (App Router) + Tailwind CSS + TypeScript |
| **App Móvil** | React Native + Expo (Implementado) |
| **Pagos** | Mercado Pago Marketplace (OAuth + Split) |
| **Edge Functions** | Deno Runtime |
| **Iconografía** | Lucide React |

---

## 📜 Licencia

Este proyecto es privado y de uso interno.

---

<div align="center">

**Desarrollado con 🎾 para la comunidad deportiva argentina.**

</div>
