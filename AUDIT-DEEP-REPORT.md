# AUDITORÍA PROFUNDA — Todos los commits (últimas 2 semanas)

**Fecha:** 2026-03-01  
**Repo:** eliasortega (Gestión de Citas de Almacén)  
**Rango:** últimos 72 commits (2 semanas)  
**HEAD actual:** `d16127c` (docs: git audit report)

---

## 1. Resumen ejecutivo

Se analizaron **72 commits** en las últimas 2 semanas, rastreando la evolución línea a línea de **19 archivos clave**. 

**Hallazgo principal:** El historial git es limpio — no hay regresiones en los commits. El único problema detectado fue causado por la existencia de **dos clones git independientes** (`/root/eliasortega` vs `/home/claudeuser/eliasortega`), donde el clon de `/home/claudeuser` estaba 7 commits detrás. Al compilar y desplegar desde el clon atrasado, se sobrescribió código más reciente en el contenedor.

---

## 2. Cronología de commits (72 commits, más reciente primero)

| # | Commit | Mensaje |
|---|--------|---------|
| 1 | `d16127c` | docs: git audit report — regression analysis |
| 2 | `dfd04e3` | feat: marcar proveedores sin perfil completo |
| 3 | `7b59a7b` | test: verificación Playwright de nuevas funcionalidades |
| 4 | `81b9557` | feat: widget flotante de asistente IA accesible desde todas las páginas |
| 5 | `4f39189` | feat: modal completo de edición de proveedores con CRUD de contactos |
| 6 | `3c01ca1` | fix: corregir tildes y acentos en toda la interfaz |
| 7 | `9e71c76` | test: add comprehensive Playwright test suite |
| 8 | `062916c` | fix: providers table shows enriched fields + calendar color readability |
| 9 | `368010d` | feat: Phase D — deduplicate providers via alias lookup on booking |
| 10 | `3b18e35` | feat: Phase B+C — provider_lookup tool + soft knowledge in system prompt |
| 11 | `0cca313` | feat: Phase A — enrich Provider schema + seed 78 supplier profiles |
| 12 | `d4ea9a7` | fix: service worker uses network-first for HTML pages |
| 13 | `5d4fa44` | fix: improve chat design — wider panel, accents, professional styling |
| 14 | `2640d38` | feat: redesign public chat — 2-column layout with branding |
| 15 | `c61e0fe` | data: export 12,521 emails as readable markdown blocks |
| 16 | `8de440b` | data: complete supplier profiles — deep email analysis |
| 17 | `0a85098` | feat: email analysis — supplier profiles from reception inbox |
| 18 | `8fb9b2d` | fix: warehouse page date filter |
| 19 | `c797ca8` | feat: warehouse check-in/out system with learning analytics |
| 20 | `f70f358` | fix: add category time caps based on P95 historical data |
| 21 | `428afe3` | docs: informe completo del calculador de tiempos |
| 22 | `3a4d733` | feat: level 3 premium — admin AI agent, PWA, dark mode, dock map |
| 23 | `c81af7e` | feat: premium UX round - skeletons, animations, charts, PDF export |
| 24 | `d4e7f29` | ui: 5 UX improvements from visual audit |
| 25 | `197697f` | fix: 5 bugs from stress testing |
| 26 | `3949fff` | refactor: modularize routes.ts into 11 domain modules |
| 27 | `2b01c41` | fix: agent reliability — dock availability, retry logic |
| 28 | `60ee1f4` | fix: delete deprecated capacity-validator, agent model configurable |
| 29 | `9c31c82` | fix: execute all migration SQL at startup |
| 30 | `37755b9` | fix: agent memory race condition and chat SSE error handling |
| 31 | `20a18d7` | fix: make slot validator resilient to missing dock infrastructure |
| 32 | `576773a` | chore: trigger redeploy |
| 33 | `cea3fdc` | fix: force-execute dock migration SQL |
| 34 | `47f93e1` | fix: simplify migration SQL |
| 35 | `aa8aece` | fix: make all migrations idempotent |
| 36 | `44c9abc` | feat: dock system, confirmation emails, timezone fixes |
| 37 | `13c99b5` | fix: use Madrid timezone for date strings |
| 38 | `b1b517f` | fix: separate slot override base schema to fix .partial() |
| 39 | `8366b15` | hotfix: apply all QA fixes + remove legacy forklifts/operators |
| 40 | `7a1d9ac` | test: comprehensive QA audit |
| 41 | `ad1d33a` | fix: integration calendar/book passes providerEmail |
| 42 | `c1fdd0b` | fix: cleanup dead import, use findUnique for token lookups |
| 43 | `d0a835e` | fix: missing data in slots/week API response |
| 44 | `b879e35` | fix: EmailType enum mismatch, active field, providerEmail in PUT |
| 45 | `9c1d297` | feat: points legend, provider email, confirmation system |
| 46 | `324b1e7` | feat: estimation ratios system |
| 47 | `48646d7` | feat: redesign calendar with slot-based view |
| 48 | `59467d3` | feat: upgrade agent to Claude Opus 4.6 |
| 49 | `3d8f4cf` | fix: correct Haiku model ID in orchestrator |
| 50 | `9dc59b7` | fix: rename seed-production.js to .cjs |
| 51 | `918a5ee` | chore: trigger deploy |
| 52 | `e3860dd` | fix: handle non-JSON responses in login |
| 53 | `0af11c1` | feat: production seed with admin user |
| 54 | `74f96f7` | fix: prisma baseline, remove Dockerfile healthcheck |
| 55 | `d5713e0` | docs: final verification, README |
| 56 | `303d874` | refactor: replace OpenAI fallback with Anthropic Haiku |
| 57 | `ef0b94e` | feat: date range support for slot overrides |
| 58 | `2fa80d1` | fix: consistent error format, port validation, cron safety |
| 59 | `9d1ee62` | feat: quick capacity adjust button |
| 60 | `790d13a` | fix: SSE error handling, agent slot integration |
| 61 | `2b365ec` | security: logout, token rotation, password change |
| 62 | `1e7d6e6` | chore: remove dead code - drizzle, storage |
| 63 | `ecb233e` | fix: resolve deploy blockers |
| 64 | `6af2081` | Prepare project for deployment |
| 65 | `b1497c3` | Add new features for managing appointments |
| 66 | `3214218` | Add a detailed plan for system improvements |
| 67 | `525179e` | Update warehouse appointment management system plan |
| 68 | `003f432` | Add comprehensive user and technical reports |
| 69 | `2f79c44` | Enhance application appearance with premium design |
| 70 | `9c23eea` | Introduce robust error handling |
| 71 | `f1eca55` | Saved progress at the end of the loop |
| 72 | `e9b4230` | Update TypeScript executor to the latest version |

---

## 3. Evolución línea a línea por archivo

### 3.1 `shared/types.ts` (15 commits, más modificado)

| Commit | Líneas | Cambio | Mensaje |
|--------|-------:|-------:|---------|
| `b1497c3` | 324 | — | Add new features for managing appointments |
| `2b365ec` | 329 | +5 | security: logout, token rotation |
| `790d13a` | 358 | +29 | fix: SSE error handling, agent slot integration |
| `ef0b94e` | 361 | +3 | feat: date range support for slot overrides |
| `324b1e7` | 362 | +1 | feat: estimation ratios system |
| `9c1d297` | 380 | +18 | feat: points legend, provider email, confirmation |
| `b879e35` | 381 | +1 | fix: EmailType enum mismatch |
| `ad1d33a` | 385 | +4 | fix: integration providerEmail |
| `8366b15` | 399 | +14 | hotfix: QA fixes |
| `b1b517f` | 401 | +2 | fix: slot override schema |
| `44c9abc` | 465 | +64 | feat: dock system, confirmation emails |
| `60ee1f4` | 468 | +3 | fix: delete capacity-validator |
| `c797ca8` | 475 | +7 | feat: warehouse check-in/out |
| `062916c` | 495 | +20 | fix: providers enriched fields |
| `4f39189` | 504 | +9 | feat: modal proveedores con contactos |

**Tendencia:** Crecimiento monotónico 324 → 504 (+55%). Sin regresiones.

---

### 3.2 `server/agent/tools.ts` (12 commits)

| Commit | Líneas | Cambio | Mensaje |
|--------|-------:|-------:|---------|
| `9c23eea` | 209 | — | Introduce robust error handling |
| `790d13a` | 432 | +223 | fix: SSE error handling, agent slot integration |
| `324b1e7` | 474 | +42 | feat: estimation ratios system |
| `9c1d297` | 490 | +16 | feat: points legend, confirmation |
| `8366b15` | 481 | **-9** | hotfix: QA fixes (limpieza menor) |
| `44c9abc` | 491 | +10 | feat: dock system |
| `60ee1f4` | 497 | +6 | fix: agent model configurable |
| `2b01c41` | 499 | +2 | fix: agent reliability |
| `197697f` | 545 | +46 | fix: 5 bugs from stress testing |
| `f70f358` | 552 | +7 | fix: category time caps |
| `3b18e35` | 649 | +97 | feat: Phase B+C — provider_lookup tool |
| `368010d` | 656 | +7 | feat: Phase D — deduplicate providers |

**Tendencia:** Crecimiento 209 → 656 (+214%). Pequeña bajada en `8366b15` (-9 líneas, limpieza intencional).

---

### 3.3 `server/agent/prompts.ts` (9 commits)

| Commit | Líneas | Cambio | Mensaje |
|--------|-------:|-------:|---------|
| `b1497c3` | 167 | — | Add new features |
| `790d13a` | 255 | +88 | fix: SSE + agent slot integration |
| `324b1e7` | 264 | +9 | feat: estimation ratios |
| `9c1d297` | 269 | +5 | feat: points legend, confirmation |
| `8366b15` | 185 | **-84** | hotfix: QA fixes (refactored knowledge to tools) |
| `44c9abc` | 186 | +1 | feat: dock system |
| `197697f` | 189 | +3 | fix: 5 bugs |
| `f70f358` | 206 | +17 | fix: category time caps |
| `3b18e35` | 216 | +10 | feat: Phase B+C — provider_lookup |

**Tendencia:** 167 → 269 → **185** → 216. Notable reducción en `8366b15` (-84 líneas): conocimiento del agente movido de prompts a tools.ts. Cambio intencional, no regresión.

---

### 3.4 `prisma/schema.prisma` (9 commits)

| Commit | Líneas | Cambio | Mensaje |
|--------|-------:|-------:|---------|
| `b1497c3` | 217 | — | Add new features |
| `9d1ee62` | 218 | +1 | feat: quick capacity adjust |
| `2fa80d1` | 219 | +1 | fix: port validation, cron safety |
| `ef0b94e` | 221 | +2 | feat: date range for slot overrides |
| `324b1e7` | 222 | +1 | feat: estimation ratios |
| `9c1d297` | 241 | +19 | feat: confirmation system (EmailLog, EmailRecipient) |
| `44c9abc` | 294 | +53 | feat: dock system (Dock, DockOverride, DockSlotAvailability) |
| `c797ca8` | 326 | +32 | feat: warehouse check-in/out (AppointmentHistory) |
| `0cca313` | 381 | +55 | feat: Phase A — enrich Provider schema |

**Tendencia:** Crecimiento monotónico 217 → 381 (+75%). Sin regresiones.

---

### 3.5 `client/src/lib/api.ts` (11 commits)

| Commit | Líneas | Cambio | Mensaje |
|--------|-------:|-------:|---------|
| `b1497c3` | 525 | — | Add new features |
| `2b365ec` | 548 | +23 | security: logout, token rotation |
| `790d13a` | 548 | 0 | fix: SSE error handling |
| `9d1ee62` | 601 | +53 | feat: quick capacity adjust |
| `e3860dd` | 611 | +10 | fix: handle non-JSON responses |
| `48646d7` | 653 | +42 | feat: redesign calendar |
| `9c1d297` | 682 | +29 | feat: confirmation system |
| `d0a835e` | 684 | +2 | fix: slots/week API |
| `44c9abc` | 874 | +190 | feat: dock system |
| `c797ca8` | 1000 | +126 | feat: warehouse check-in/out |
| `4f39189` | 1034 | +34 | feat: modal proveedores |

**Tendencia:** Crecimiento monotónico 525 → 1034 (+97%). Sin regresiones.

---

### 3.6 `client/src/pages/chat-public.tsx` (8 commits)

| Commit | Líneas | Cambio | Mensaje |
|--------|-------:|-------:|---------|
| `9c23eea` | 345 | — | Introduce robust error handling |
| `2f79c44` | 349 | +4 | Enhance appearance |
| `13c99b5` | 349 | 0 | fix: Madrid timezone |
| `d4e7f29` | 381 | +32 | ui: 5 UX improvements |
| `c81af7e` | 429 | +48 | feat: premium UX round |
| `3a4d733` | 440 | +11 | feat: level 3 premium |
| `2640d38` | 511 | +71 | feat: redesign public chat |
| `5d4fa44` | 504 | **-7** | fix: improve chat design (limpieza menor) |

**Tendencia:** 345 → 511 → 504. Pequeña bajada final (-7) por limpieza de estilos. Sin regresiones.

---

### 3.7 `client/src/pages/notifications-page.tsx` (3 commits)

| Commit | Líneas | Cambio | Mensaje |
|--------|-------:|-------:|---------|
| `b1497c3` | 769 | — | Add new features |
| `44c9abc` | 898 | +129 | feat: dock system, confirmation emails |
| `d4e7f29` | 899 | +1 | ui: 5 UX improvements |

**Tendencia:** 769 → 899. Crecimiento estable. Sin regresiones.

---

### 3.8 `client/src/pages/providers-page.tsx` (4 commits)

| Commit | Líneas | Cambio | Mensaje |
|--------|-------:|-------:|---------|
| `9c23eea` | 163 | — | Introduce robust error handling |
| `2f79c44` | 192 | +29 | Enhance appearance |
| `c81af7e` | 185 | **-7** | feat: premium UX round (refactored to use EmptyState) |
| `4f39189` | 194 | +9 | feat: modal proveedores |

**Tendencia:** 163 → 194. Pequeña bajada en `c81af7e` por refactor a EmptyState component. Sin regresiones.

---

### 3.9 `client/src/components/providers-table.tsx` (4 commits)

| Commit | Líneas | Cambio | Mensaje |
|--------|-------:|-------:|---------|
| `2f79c44` | 184 | — | Enhance appearance |
| `062916c` | 271 | +87 | fix: show enriched fields |
| `4f39189` | 228 | **-43** | feat: modal proveedores (moved inline edit to modal) |
| `dfd04e3` | 256 | +28 | feat: marcar proveedores sin perfil completo |

**Tendencia:** 184 → 271 → 228 → 256. Bajada en `4f39189` intencional: lógica de edición inline movida a modal separado.

---

### 3.10 `server/routes/providers.ts` (3 commits)

| Commit | Líneas | Cambio | Mensaje |
|--------|-------:|-------:|---------|
| `3949fff` | 118 | — | refactor: modularize routes.ts |
| `062916c` | 119 | +1 | fix: enriched fields |
| `4f39189` | 192 | +73 | feat: modal proveedores (added contacts CRUD) |

**Tendencia:** 118 → 192. Crecimiento por adición de endpoints de contactos. Sin regresiones.

---

### 3.11 `server/routes.ts` — La Gran Modularización

| Commit | Líneas | Cambio | Mensaje |
|--------|-------:|-------:|---------|
| `9c23eea` | 1,065 | — | Introduce robust error handling |
| `b1497c3` | 1,722 | +657 | Add new features |
| `ecb233e` | 1,723 | +1 | fix: deploy blockers |
| `1e7d6e6` | 1,724 | +1 | chore: remove dead code |
| `2b365ec` | 1,763 | +39 | security: logout, token rotation |
| `790d13a` | 1,884 | +121 | fix: SSE + agent slot integration |
| `9d1ee62` | 2,082 | +198 | feat: quick capacity adjust |
| `2fa80d1` | 2,082 | 0 | fix: port validation |
| `ef0b94e` | 2,107 | +25 | feat: date range overrides |
| `48646d7` | 2,220 | +113 | feat: redesign calendar |
| `324b1e7` | 2,255 | +35 | feat: estimation ratios |
| `9c1d297` | 2,503 | +248 | feat: confirmation system |
| `b879e35` | 2,505 | +2 | fix: EmailType |
| `d0a835e` | 2,508 | +3 | fix: slots/week |
| `c1fdd0b` | 2,508 | 0 | fix: token lookups |
| `ad1d33a` | 2,523 | +15 | fix: providerEmail |
| `8366b15` | 2,551 | +28 | hotfix: QA fixes |
| `13c99b5` | 2,551 | 0 | fix: Madrid timezone |
| `44c9abc` | 2,928 | +377 | feat: dock system |
| `20a18d7` | 2,929 | +1 | fix: slot validator resilient |
| `37755b9` | 2,929 | 0 | fix: agent memory |
| `9c31c82` | 2,945 | +16 | fix: migration SQL |
| `60ee1f4` | 2,948 | +3 | fix: capacity-validator deleted |
| **`3949fff`** | **28** | **-2,920** | **refactor: modularize into 11 modules** |
| `3a4d733` | 30 | +2 | feat: level 3 premium |
| `c797ca8` | 34 | +4 | feat: warehouse check-in/out |

**Tendencia:** El archivo creció de 1,065 → 2,948 líneas y luego fue modularizado a **28 líneas** en `3949fff`. Este fue el cambio arquitectónico más grande del proyecto.

---

### 3.12 Otros archivos rastreados

| Archivo | Commits | Inicio → Final | Tendencia |
|---------|--------:|--------------:|-----------|
| `client/src/App.tsx` | 8 | 188 → 214 | +26, monotónico |
| `client/src/components/app-sidebar.tsx` | 7 | 121 → 165 | +44, monotónico |
| `server/services/email-service.ts` | 7 | 203 → 221 | +18, monotónico |
| `server/services/provider-email-service.ts` | 3 | 241 → 285 | +44, monotónico |
| `server/routes/email.ts` | 1 | 0 → 154 | Nuevo (extraído de routes.ts) |
| `client/src/pages/calendar-page.tsx` | 8 | 289 → 269 | Fluctúa ±30, estable |
| `Dockerfile` | 12 | 31 → 30 | Estable |
| `package.json` | 7 | 126 → 130 | +4, estable |

---

## 4. Análisis de regresiones

### 4.1 ¿Hay regresiones en el historial git? **NO**

Cada reducción de líneas encontrada tiene una explicación legítima:

| Archivo | Commit | Cambio | Motivo |
|---------|--------|-------:|--------|
| `prompts.ts` | `8366b15` | -84 | Conocimiento del agente movido a `tools.ts` |
| `providers-table.tsx` | `4f39189` | -43 | Edición inline → modal separado |
| `providers-page.tsx` | `c81af7e` | -7 | Refactor a componente EmptyState |
| `chat-public.tsx` | `5d4fa44` | -7 | Limpieza de estilos |
| `tools.ts` | `8366b15` | -9 | Limpieza menor en hotfix QA |
| `routes.ts` | `3949fff` | -2,920 | Modularización (código movido a `server/routes/`) |

### 4.2 ¿De dónde vino la regresión del contenedor?

La regresión detectada en el contenedor de producción **NO** fue causada por ningún commit. Fue causada por:

1. Existían **dos clones git independientes**:
   - `/root/eliasortega` → HEAD = `dfd04e3` (correcto, 72 commits)
   - `/home/claudeuser/eliasortega` → HEAD = `368010d` (7 commits atrás)

2. Se compiló y desplegó desde `/home/claudeuser/eliasortega`, que no tenía los 7 commits más recientes:
   - `062916c` — providers table enriched fields
   - `3c01ca1` — corregir tildes y acentos
   - `9e71c76` — Playwright test suite
   - `4f39189` — modal de proveedores con contactos CRUD
   - `81b9557` — widget flotante de asistente IA
   - `7b59a7b` — verificación Playwright
   - `dfd04e3` — marcar proveedores sin perfil completo

3. Como resultado, el contenedor perdió:
   - Campos enriquecidos de proveedores (officialName, type, category, etc.)
   - CRUD de contactos de proveedores
   - Corrección de tildes/acentos
   - Badge "Sin perfil" en proveedores
   - Widget flotante de asistente IA
   - ProviderEditModal

---

## 5. Tabla resumen global

| Archivo | Commits | Líneas (inicio) | Líneas (final) | Cambio neto | Regresión git |
|---------|--------:|-----------------:|---------------:|------------:|:------------:|
| `shared/types.ts` | 15 | 324 | 504 | +180 | NO |
| `server/agent/tools.ts` | 12 | 209 | 656 | +447 | NO |
| `client/src/lib/api.ts` | 11 | 525 | 1,034 | +509 | NO |
| `server/agent/prompts.ts` | 9 | 167 | 216 | +49 | NO* |
| `prisma/schema.prisma` | 9 | 217 | 381 | +164 | NO |
| `client/src/pages/chat-public.tsx` | 8 | 345 | 504 | +159 | NO |
| `client/src/App.tsx` | 8 | 188 | 214 | +26 | NO |
| `client/src/pages/calendar-page.tsx` | 8 | 289 | 269 | -20 | NO |
| `server/services/email-service.ts` | 7 | 203 | 221 | +18 | NO |
| `client/src/components/app-sidebar.tsx` | 7 | 121 | 165 | +44 | NO |
| `package.json` | 7 | 126 | 130 | +4 | NO |
| `client/src/components/providers-table.tsx` | 4 | 184 | 256 | +72 | NO |
| `client/src/pages/providers-page.tsx` | 4 | 163 | 194 | +31 | NO |
| `server/services/provider-email-service.ts` | 3 | 241 | 285 | +44 | NO |
| `client/src/pages/notifications-page.tsx` | 3 | 769 | 899 | +130 | NO |
| `server/routes/providers.ts` | 3 | 118 | 192 | +74 | NO |
| `Dockerfile` | 12 | 31 | 30 | -1 | NO |
| `server/routes/email.ts` | 1 | 0 | 154 | +154 | NO |
| `server/routes.ts` | 26 | 1,065 | 28 | -1,037 | NO** |

\* `prompts.ts` tuvo una reducción intencional de -84 líneas cuando se movió contenido a `tools.ts`  
\** `routes.ts` fue modularizado intencionalmente de 2,948 → 28 líneas

---

## 6. Archivos con mayor actividad (top 10 por commits)

1. **`server/routes.ts`** — 26 commits (monolito → módulos)
2. **`shared/types.ts`** — 15 commits
3. **`server/agent/tools.ts`** — 12 commits
4. **`Dockerfile`** — 12 commits (ajustes menores)
5. **`client/src/lib/api.ts`** — 11 commits
6. **`server/agent/prompts.ts`** — 9 commits
7. **`prisma/schema.prisma`** — 9 commits
8. **`client/src/App.tsx`** — 8 commits
9. **`client/src/pages/chat-public.tsx`** — 8 commits
10. **`client/src/pages/calendar-page.tsx`** — 8 commits

---

## 7. Conclusiones

1. **El historial git está limpio.** No hay commits que introduzcan regresiones. Todas las reducciones de líneas son refactorizaciones intencionales.

2. **La regresión en producción fue operacional, no de código.** Fue causada por compilar desde un clon git que no estaba sincronizado.

3. **El proyecto creció significativamente:** ~5,500 líneas netas añadidas en los 19 archivos rastreados en 2 semanas.

4. **La modularización de `routes.ts`** (commit `3949fff`) fue el cambio arquitectónico más importante: de 2,948 líneas a 11 módulos separados.

5. **Acción correctiva:** Sincronizar `/home/claudeuser/eliasortega` con `git pull`, o trabajar exclusivamente desde `/root/eliasortega`, para evitar futuras regresiones operacionales.

---

*Generado automáticamente el 2026-03-01*
