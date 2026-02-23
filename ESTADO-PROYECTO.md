# Estado del Proyecto - Centro Hogar Sanchez

**Fecha de revision:** 2026-02-24
**Version:** 2.0 (slot-based capacity system)

---

## Problemas detectados en el analisis original

| ID | Problema | Estado | Resolucion |
|----|----------|--------|------------|
| P1 | `localhost` hardcoded en produccion (agente IA falla en Docker) | Resuelto | `ecb233e` - Se creo `server/utils/base-url.ts` con `BASE_URL` env var y fallback |
| P2 | Inconsistencia auth en integracion (upsert usaba JWT en vez de API Key) | Resuelto | `ecb233e` - Corregido a `authenticateIntegration` middleware |
| P3 | Sin endpoint de logout (tokens no se invalidan) | Resuelto | `2b365ec` - Endpoint `POST /api/auth/logout` con blacklist de refresh tokens |
| P4 | Race condition en SSE (error handling tras `flushHeaders`) | Resuelto | `790d13a` - Errores se envian como chunks SSE en vez de `res.status()` |
| P5 | Configuracion Drizzle/Prisma conflictiva (`drizzle.config.ts`) | Resuelto | `1e7d6e6` - Eliminados archivos Drizzle (`drizzle.config.ts`, `schema-drizzle.ts`) |
| P6 | Email diario enviaba datos de manana en vez de hoy | No aplica | El comportamiento es intencionado: resumen nocturno de las citas de manana |
| P7 | Dos sistemas de validacion de capacidad independientes | Resuelto | `790d13a` + plan slot-based - Se reemplazo `capacityValidator` por `slotCapacityValidator` en todas las rutas |
| P8 | Docker usa `prisma db push` en cada arranque en vez de migraciones | Resuelto | `ecb233e` - Dockerfile usa `prisma migrate deploy` en produccion |
| P9 | Falta validacion Zod en endpoint de email recipients | Resuelto | `2b365ec` - Schemas Zod para create/update email recipients |
| P10 | Import no usado de `clearRefreshToken` en routes | Resuelto | `1e7d6e6` - Eliminado codigo muerto |
| P11 | Modulo `storage.ts` obsoleto importa tipos inexistentes | Resuelto | `1e7d6e6` - Archivo eliminado |
| P12 | Refresh token no se rota en cada uso | Resuelto | `2b365ec` - Rotacion automatica: cada refresh emite nuevo token |
| P13 | Formatos de error inconsistentes en endpoints de integracion | Resuelto | `2fa80d1` - Todos usan `{ success, error, details? }` / `{ success, data }` |
| P14 | Sin error handling en inicio de cron de email | Resuelto | `2fa80d1` - `try-catch` alrededor de `startEmailCron()` |
| P15 | Credenciales por defecto hardcoded en seed files | Pendiente | `admin@example.com / CHS-Admin-2026!` en `replit.md` - requiere cambio tras primer login |
| P16 | Sin endpoint para cambiar contrasena | Resuelto | `2b365ec` - Endpoint `PUT /api/auth/change-password` |
| P17 | `schema-drizzle.ts` con exports faltantes | Resuelto | `1e7d6e6` - Archivo eliminado junto con toda la capa Drizzle |
| P18 | `seed-slots.ts` huerfano sin referencia | No aplica | Se mantiene como utilidad manual (`npx tsx server/seed-slots.ts`) |
| P19 | Sin validacion de que PORT sea numerico | Resuelto | `2fa80d1` - Validacion `isNaN(port) || port < 1 || port > 65535` con `process.exit(1)` |

**Resumen:** 16 resueltos, 2 no aplican, 1 pendiente (menor).

---

## Mejoras implementadas (no derivadas de problemas)

| Mejora | Commit | Descripcion |
|--------|--------|-------------|
| Sistema de slots v2.0 | `b1497c3` + refactors | SlotTemplates + SlotOverrides con puntos (S=1pt, M=2pts, L=3pts) |
| Validacion slot como puerta unica | `790d13a` | `slotCapacityValidator` reemplaza al legacy en todas las rutas |
| Prompts dinamicos del agente | `790d13a` | `getActiveSlotSchedule()` lee franjas de BD con cache 5min |
| Herramientas del agente sin HTTP | `790d13a` | Tools llaman a Prisma y slot-validator directamente |
| Ajuste rapido de capacidad | `9d1ee62` | Boton one-click para reducir/ampliar capacidad diaria |
| Rangos de fecha en excepciones | `ef0b94e` | `dateEnd` en SlotOverride, una excepcion cubre multiples dias |
| Sustitucion OpenAI por Anthropic | `303d874` | Calculadora usa Claude Haiku, dependencia `openai` eliminada |
| Formato error consistente | `2fa80d1` | Endpoints de integracion usan `{ success, error/data }` |
| Documentacion dayOfWeek | `2fa80d1` | Comentario JSDoc en schema.prisma (0=Sunday, JS convention) |
| Selector de slot en formulario | `790d13a` | Dropdown de franjas disponibles con puntos al crear cita |
| Indicadores de capacidad slot-based | `790d13a` | Barras de progreso por franja en vez de workers/forklifts/docks |
| Dialog de conflicto slot-based | `790d13a` | Muestra franja, puntos usados/maximos, mensaje en espanol |

---

## Deudas tecnicas pendientes

| Prioridad | Deuda | Descripcion |
|-----------|-------|-------------|
| Baja | Credenciales seed | P15: el seed usa credenciales conocidas; mitigado con aviso de cambio |
| Baja | `capacity-validator.ts` deprecated | El archivo legacy existe con `@deprecated` + `console.warn`; se puede eliminar cuando se confirme que no hay dependencias externas |
| Baja | Chunk size warning en build | Vite advierte que el bundle JS supera 500KB; se podria resolver con code-splitting via `import()` |
| Baja | `ANALISIS-PROYECTO.md` desactualizado | Referencia el sistema legacy como actual; contiene `admin123` en documentacion |
| Info | `attached_assets/` | Contiene JSONs de n8n workflows y archivos de planificacion historicos; no afecta al sistema |

---

## Verificacion final (2026-02-24)

- `npm run build`: Compila sin errores
- `grep -ri "openai" server/`: Solo un comentario explicativo en `llm-clients.ts`
- `grep "capacity-validator\|capacityValidator" server/routes.ts`: Sin resultados
- `grep "localhost" server/`: Solo en `base-url.ts` (fallback) y `index.ts` (log de arranque)
- `grep "admin123" server/`: Sin resultados (solo en documentacion legacy)
- TODO/FIXME en codigo: Ninguno encontrado
