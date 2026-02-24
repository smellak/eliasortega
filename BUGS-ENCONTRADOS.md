# Informe de Bugs y Problemas
## Fecha: 2026-02-24
## Total: 22 bugs encontrados (3 criticos, 7 altos, 8 medios, 4 bajos)

---

### CRITICOS (bloquean uso en produccion)

| # | Descripcion | Archivo | Linea(s) | Como reproducir |
|---|---|---|---|---|
| C1 | **Timezone: `startOfDay`/`endOfDay` usan UTC en lugar de Europe/Madrid** — El resumen diario por email puede perder citas de las 23:00-00:00 hora Madrid o incluir citas del dia siguiente | `server/services/email-service.ts` | 102-103 | Crear cita a las 23:30 Madrid. Ejecutar `sendDailySummary()` para ese dia. La cita no aparece en el resumen porque `startOfDay/endOfDay` calculan limites en UTC, no en Madrid. |
| C2 | **Timezone: `getDay()` sobre Date UTC da dia incorrecto para madrugada Madrid** — Citas creadas entre 00:00-01:00 Madrid (23:00-00:00 UTC del dia anterior) usan las plantillas de slots del dia equivocado | `server/services/slot-validator.ts`, `server/routes.ts` | slot-validator:101,260; routes:1067,1460,2320 | Crear cita para lunes a las 00:30 Madrid. `getDay()` sobre el UTC equivalente (domingo 23:30) devuelve 0 (domingo) en vez de 1 (lunes). Se buscan plantillas del domingo (que no existen) y falla la validacion. |
| C3 | **Timezone: `setHours(0,0,0,0)` pone medianoche UTC, no Madrid** — `slotDate` se calcula mal en todas las rutas de creacion/actualizacion de citas, afectando el campo `slot_date` almacenado | `server/routes.ts` | 124, 1067, 1196, 1458, 1569, 2324, 2370 | Crear cita para cualquier dia. El `slotDate` almacenado puede ser el dia anterior si la hora Madrid es 00:00-01:00 (UTC del dia previo). |

---

### ALTOS (funcionan mal pero no crashean)

| # | Descripcion | Archivo | Linea(s) | Como reproducir |
|---|---|---|---|---|
| A1 | **No se valida que la fecha de la cita sea futura** — Se pueden crear citas en fechas pasadas (2020, etc.) | `shared/types.ts` | 97-103 | `POST /api/appointments` con `start: "2020-01-01T10:00:00Z"`. Se crea sin error. |
| A2 | **`estimatedFields` se devuelve como string JSON en vez de array** — El API almacena `"[\"lines\"]"` y lo devuelve asi en vez de `["lines"]` parseado | `server/routes.ts` | GET /api/appointments (devuelve Prisma raw) | Crear cita con estimacion. GET /api/appointments devuelve `estimatedFields: "[\"lines\"]"` en vez de array. Frontend debe parsear manualmente. |
| A3 | **`reminderSentAt` se marca ANTES de enviar el email** — Si el envio falla, el recordatorio se pierde para siempre sin reintento | `server/services/provider-email-service.ts` | 177-180 | Configurar SMTP invalido. El cron marca `reminderSentAt` y luego el envio falla. En la siguiente ejecucion del cron, esa cita ya no se selecciona. |
| A4 | **Race condition en cron de recordatorios** — Sin bloqueo, dos instancias pueden enviar recordatorios duplicados | `server/services/provider-email-service.ts` | 221-241 | Ejecutar dos instancias del servidor (o si el cron tarda mas de lo esperado y se solapa). Ambas leen las mismas citas con `reminderSentAt=null` y envian duplicados. |
| A5 | **XSS en pagina de confirmacion HTML** — `providerName`, `goodsType` y `cancellationReason` se insertan sin escapar en HTML renderizado por el servidor | `server/routes.ts` | 301, 304, 315, 343 | Crear cita con `providerName: "<img src=x onerror=alert(1)>"`. Abrir la pagina de confirmacion. El JS se ejecuta en el navegador del proveedor. |
| A6 | **Se puede cancelar una cita ya confirmada sin restriccion** — El endpoint publico permite pasar de "confirmed" a "cancelled" sin verificacion adicional | `server/routes.ts` | 254-268 | `POST /api/appointments/confirm` con `action: "cancel"` y token de una cita con `confirmationStatus: "confirmed"`. Se cancela sin problema. |
| A7 | **Endpoint POST /api/auth/refresh no usa validacion Zod** — Inconsistente con el resto de endpoints de auth, acepta cualquier body | `server/routes.ts` | 446-467 | Enviar body con campos extra o tipos incorrectos. No se valida con schema Zod como los demas endpoints de auth. |

---

### MEDIOS (UX pobre o inconsistencias)

| # | Descripcion | Archivo | Linea(s) | Como reproducir |
|---|---|---|---|---|
| M1 | **Sin rate limiting en endpoints publicos de confirmacion** — Expuesto a brute force o DoS | `server/routes.ts` | 219, 238 | Los endpoints `GET/POST /api/appointments/confirm/:token` no tienen rate limiter, a diferencia de los endpoints de integracion que si lo tienen. |
| M2 | **Inconsistencia null/undefined en upsert vs create** — `upsertAppointmentInternal` usa `?? undefined` y POST create usa `\|\| null` para providerEmail/Phone | `server/routes.ts` | 165-166 vs 1108-1109 | Para Prisma, `undefined` = no actualizar, `null` = poner NULL. El upsert no borra emails vacios al actualizar. |
| M3 | **`workMinutesNeeded: min(0)` permite valor 0** — No tiene sentido crear cita con 0 minutos de trabajo. Deberia ser `min(1)` | `shared/types.ts` | 86 | `POST /api/appointments` con `workMinutesNeeded: 0`. Se acepta y crea con tamanio S y 1 punto. |
| M4 | **GET /api/slots/availability no valida parametro `date` invalido** — `new Date("invalid")` crea Invalid Date sin devolver 400 | `server/routes.ts` | 956 | `GET /api/slots/availability?date=invalid`. `new Date("invalid")` no lanza error, devuelve resultados impredecibles. |
| M5 | **No validacion de que dateEnd >= date en schema de SlotOverride** — Solo se valida en la ruta, no en el schema Zod | `shared/types.ts` | 167-174 | El schema `createSlotOverrideSchema` acepta `dateEnd` anterior a `date`. La validacion manual existe en la ruta pero no en el schema compartido. |
| M6 | **Dialog de citas no valida formato de email en JS** — Solo depende de HTML5 `type="email"`, no hay validacion en la funcion `validate()` | `client/src/components/appointment-dialog.tsx` | 194-237, 540 | Escribir email invalido en el campo, el formulario se envia y es el backend quien rechaza con 400. |
| M7 | **Citas en domingo se pueden crear via API directa** — GET /api/slots/week excluye domingos pero POST /api/appointments los acepta | `server/routes.ts` | 1058, 2326 | `POST /api/appointments` con `start` en domingo. Se crea pero no aparece en el calendario semanal. |
| M8 | **Double-confirm devuelve 200 success** — Confirmar una cita ya confirmada devuelve `200 success` con mensaje "ya estaba confirmada" en vez de 409 | `server/routes.ts` | 250-252 | `POST /api/appointments/confirm` con `action: "confirm"` sobre cita ya confirmada. Devuelve 200 en vez de 409 Conflict. |

---

### BAJOS (mejoras menores, limpieza)

| # | Descripcion | Archivo | Linea(s) | Como reproducir |
|---|---|---|---|---|
| B1 | **Calculator fallback hardcodea "Mobiliario"** — Cuando el LLM falla para categorias desconocidas, devuelve 60 min de "Mobiliario" silenciosamente | `server/agent/calculator.ts` | 216-227 | Provocar fallo del LLM (API key invalida, timeout). El calculator devuelve valores por defecto sin informar al agente. |
| B2 | **Mensajes de validacion HTML5 del email en ingles** — El browser muestra "Please include an '@'" en ingles | `client/src/components/appointment-dialog.tsx` | 540 | Escribir email sin @ en el campo. Chrome/Firefox muestran mensaje en ingles. |
| B3 | **Import muerto `Package` en slot-calendar** — Eliminado en commit previo, verificar que no haya regresado | `client/src/components/slot-calendar.tsx` | 8 | Ya corregido. Verificar con grep. |
| B4 | **Boton de reactivar sin estado de loading** — El boton de reactivar cita cancelada no tiene indicador de carga | `client/src/components/appointment-dialog.tsx` | 588-603 | Click en "Reactivar" — no hay spinner ni disabled, se puede clickar multiples veces. |

---

### RESUMEN DE TESTS DE CHAT (Analisis Estatico)

| Escenario | Resultado | Notas |
|---|---|---|
| Proveedor ideal (datos completos) | OK | Flujo correcto, calculo deterministico |
| Proveedor minimo (solo obligatorios) | OK | Elias estima con ratios correctamente |
| Proveedor vago ("quiero descargar") | OK | Prompt instruye pedir tipo y unidades |
| Proveedor con categoria rara ("lamparas") | WARN | LLM intenta normalizar; fallback a "Mobiliario" 60min si falla |
| Proveedor que da email | OK | Se guarda, se envia confirmacion |
| Proveedor que no da email | OK | Prompt instruye no insistir |
| Proveedor pide fecha especifica | OK | Tool calendar_availability busca franja |
| Proveedor pide domingo | WARN | No hay slots para domingo, pero el mensaje de error no es explicito |
| Proveedor cancela a mitad | OK | Agente maneja gracefully |
| Proveedor en ingles | OK | LLM maneja multilingue naturalmente |
| Proveedor con XSS | FAIL | Texto se almacena sin sanitizar. React escapa en frontend pero pagina confirmacion (server-side HTML) es vulnerable |
| Proveedor con 999999 unidades | OK | Calculo devuelve ~120000 min, no crashea |
| Proveedor con 0 unidades | OK | Devuelve minimo 15 min |
| Proveedor con -5 unidades | WARN | Schema Zod rechaza min(0) pero coercion puede comportarse raro |
| Dos proveedores simultaneos | OK | Transaccion Serializable previene race condition |
| Cada categoria (8 tipos) | OK | Ratios deterministicos configurados correctamente |

---

### SUGERENCIAS DE MEJORA

1. **Usar `date-fns-tz` consistentemente** — Reemplazar todos los `startOfDay()`, `endOfDay()`, `setHours()`, `getDay()` con equivalentes timezone-aware de `date-fns-tz` (`fromZonedTime`, `toZonedTime`)
2. **Agregar HTML escaping utility** — Una funcion `escapeHtml()` para usar en todas las plantillas HTML server-side
3. **Agregar rate limiter global** — Para endpoints publicos, al menos `express-rate-limit` con 30 req/min
4. **Tests automatizados** — No existen tests. Agregar al menos tests unitarios para calculator, slot-validator, y tests de integracion para endpoints criticos
5. **Logs estructurados** — Reemplazar `console.log/error` con un logger como `pino` que incluya timestamps, request IDs, y niveles
6. **Retry en envio de emails** — Si falla el envio, marcar como "RETRYING" y reintentar en la siguiente ejecucion del cron
7. **Monitorizacion de salud** — Endpoint `/api/health` que verifique conexion a BD y SMTP
