# 001 — Migración a CourtUp-main + Fixes AI
**Fecha:** 2026-06-26 | **Hora:** 20:14 | **Responsable:** Marcos Marfeo

---

## Contexto
Se tomó `CourtUp-main` como base canónica del proyecto y se portaron las funcionalidades desarrolladas en `12-CourtApp/CourtUp`. Se realizó un force-push al repositorio `mmarfeo/courtapp-version-marcos` y se actualizó el VPS.

---

## Cambios realizados

### Archivos nuevos
1. `web/src/components/AIAssistant.tsx` — Botón flotante de chat con streaming SSE
2. `web/src/lib/hooks/useAIChat.ts` — Hook de chat con persistencia en `sessionStorage`
3. `web/src/lib/supabase-tools.ts` — 7 herramientas Supabase para el agente de IA
4. `web/src/app/api/ai/chat/route.ts` — Endpoint SSE con Gemini y fallback a Ollama
5. `web/src/app/api/admin/logs/route.ts` — Endpoint SSE que transmite logs de PM2
6. `web/src/app/api/clases/reservar/route.ts` — Endpoint POST para reservar clases
7. `web/src/app/admin/logs/page.tsx` — Visor de logs en tiempo real (terminal oscura)
8. `web/src/app/admin/page.tsx` — Redirección de `/admin` → `/admin/dashboard`
9. `web/src/app/api/chat/webhook/route.ts` — Webhook de chat existente (portado)
10. `web/.env.example` — Documentación de variables de entorno (sin claves reales)

### Archivos modificados
11. `web/src/lib/supabase.ts` — Reemplazado `throw` por valores placeholder en env faltantes
12. `web/src/app/layout.tsx` — Agregado `<AIAssistant />` y su import
13. `web/next.config.mjs` — Agregado `generativelanguage.googleapis.com` al CSP `connect-src`
14. `.gitignore` — Excluidos scripts de desarrollo local (`fetch_clases.js`, `scratch/`, etc.)

---

## Bugs corregidos

| # | Bug | Causa | Solución |
|---|-----|-------|----------|
| 1 | AI no encontraba reservas de canchas | Tabla renombrada `alquileres` → `alquileres_cancha` | Corregido en `supabase-tools.ts` y `ai/chat/route.ts` |
| 2 | AI usaba fecha 2025 en vez de la actual | Sin contexto de fecha en el system prompt | `buildSystemPrompt()` inyecta fecha de Argentina en cada request |
| 3 | Mensajes del chat se borraban al navegar | Sin persistencia entre remounts de React | `sessionStorage` en `useAIChat.ts` |
| 4 | Error cliente en `/admin` | Faltaba `page.tsx` en la ruta | Creada página con `redirect('/admin/dashboard')` |
| 5 | Filtro de fechas en `consultar_mis_clases` fallaba | PostgREST no soporta filtros sobre columnas anidadas | Filtrado en JavaScript post-fetch |
| 6 | `ReferenceError: Landmark is not defined` en Sidebar | Import faltante de `lucide-react` | Agregado `Landmark` al import (ya presente en CourtUp-main) |

---

## Despliegue VPS (`212.85.23.150`)

```bash
git reset --hard origin/main   # ✓
npm install                    # ✓
npm run build                  # ✓ (sin errores)
pm2 restart courtup-marcos     # ✓ online
```

---

## Pendiente

- [ ] Rotar `SUPABASE_SERVICE_ROLE_KEY` en Supabase Dashboard (clave expuesta en sesión anterior)
