# Fixes Sugeridos para Bugs Encontrados
## Fecha: 2026-02-24

Cada fix incluye el codigo exacto o cambios necesarios. NO aplicar todavia.

---

## CRITICOS

### Fix C1: Timezone en Daily Summary (`email-service.ts`)

**Archivo:** `server/services/email-service.ts`
**Lineas:** 11, 102-103

```typescript
// ANTES (linea 11):
import { startOfDay, endOfDay, addDays } from "date-fns";

// DESPUES:
import { addDays } from "date-fns";
import { fromZonedTime } from "date-fns-tz";

// ANTES (lineas 102-103):
const dayStart = startOfDay(date);
const dayEnd = endOfDay(date);

// DESPUES:
const dateStr = formatInTimeZone(date, "Europe/Madrid", "yyyy-MM-dd");
const dayStart = fromZonedTime(`${dateStr}T00:00:00`, "Europe/Madrid");
const dayEnd = fromZonedTime(`${dateStr}T23:59:59.999`, "Europe/Madrid");
```

---

### Fix C2+C3: Timezone en slot-validator y routes

**Problema central:** `setHours(0,0,0,0)` y `getDay()` operan en UTC.

**Solucion:** Crear utility function y usarla en todos los sitios afectados.

**Archivo nuevo:** `server/utils/madrid-date.ts`

```typescript
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

const TZ = "Europe/Madrid";

/** Get day of week (0-6) in Madrid timezone */
export function getMadridDayOfWeek(date: Date): number {
  const dayStr = formatInTimeZone(date, TZ, "i"); // 1=Mon..7=Sun (ISO)
  const isoDay = parseInt(dayStr, 10);
  return isoDay === 7 ? 0 : isoDay; // Convert to JS: 0=Sun, 1=Mon..6=Sat
}

/** Get midnight in Madrid as UTC Date */
export function getMadridMidnight(date: Date): Date {
  const dateStr = formatInTimeZone(date, TZ, "yyyy-MM-dd");
  return fromZonedTime(`${dateStr}T00:00:00`, TZ);
}

/** Get end of day in Madrid as UTC Date */
export function getMadridEndOfDay(date: Date): Date {
  const dateStr = formatInTimeZone(date, TZ, "yyyy-MM-dd");
  return fromZonedTime(`${dateStr}T23:59:59.999`, TZ);
}

/** Get HH:mm in Madrid timezone */
export function getMadridTime(date: Date): string {
  return formatInTimeZone(date, TZ, "HH:mm");
}

/** Get yyyy-MM-dd in Madrid timezone */
export function getMadridDateStr(date: Date): string {
  return formatInTimeZone(date, TZ, "yyyy-MM-dd");
}
```

**Cambios en `server/services/slot-validator.ts`:**

```typescript
// ANTES (linea 101):
const dayOfWeek = date.getDay();

// DESPUES:
import { getMadridDayOfWeek } from "../utils/madrid-date";
const dayOfWeek = getMadridDayOfWeek(date);
```

**Cambios en `server/routes.ts` (TODOS los setHours y getDay):**

```typescript
// Importar al inicio:
import { getMadridDayOfWeek, getMadridMidnight, getMadridEndOfDay } from "./utils/madrid-date";

// Reemplazar CADA instancia de:
slotDate.setHours(0, 0, 0, 0);
// Por:
const slotDate = getMadridMidnight(startDate);

// Reemplazar CADA instancia de:
const dayOfWeek = targetDate.getDay();
// Por:
const dayOfWeek = getMadridDayOfWeek(targetDate);

// Reemplazar CADA instancia de:
current.setHours(0, 0, 0, 0);
end.setHours(23, 59, 59, 999);
// Por:
const current = getMadridMidnight(new Date(from));
const end = getMadridEndOfDay(new Date(to));
```

**Lineas afectadas en routes.ts:** 124, 996-998, 1067, 1196, 1363-1364, 1413-1414, 1458, 1460, 1569, 1571, 2324, 2370-2372

---

## ALTOS

### Fix A1: Validacion de fecha futura

**Archivo:** `shared/types.ts`
**Lineas:** 97-103

```typescript
// ANTES:
export const createAppointmentSchema = appointmentBaseSchema.refine(
  data => new Date(data.end) > new Date(data.start),
  {
    message: "End time must be after start time",
    path: ["end"],
  }
);

// DESPUES:
export const createAppointmentSchema = appointmentBaseSchema
  .refine(
    data => new Date(data.end) > new Date(data.start),
    {
      message: "End time must be after start time",
      path: ["end"],
    }
  )
  .refine(
    data => new Date(data.start) > new Date(),
    {
      message: "Start time must be in the future",
      path: ["start"],
    }
  );
```

**Nota:** Esto NO debe aplicarse al `updateAppointmentSchema` (que es partial) ni al `upsertAppointmentSchema` (las integraciones pueden necesitar fechas flexibles).

---

### Fix A2: Parsear estimatedFields en API response

**Archivo:** `server/routes.ts`
**Lineas:** GET /api/appointments (~1032-1056)

```typescript
// ANTES:
const appointments = await prisma.appointment.findMany({
  where,
  orderBy: { startUtc: "asc" },
});
res.json(appointments);

// DESPUES:
const appointments = await prisma.appointment.findMany({
  where,
  orderBy: { startUtc: "asc" },
});
const parsed = appointments.map(a => ({
  ...a,
  estimatedFields: a.estimatedFields ? JSON.parse(a.estimatedFields) : null,
}));
res.json(parsed);
```

**Tambien aplicar** en GET /api/appointments/:id (si existe) y en los responses de POST/PUT que devuelven la cita creada.

---

### Fix A3: Marcar reminderSentAt DESPUES de enviar

**Archivo:** `server/services/provider-email-service.ts`
**Lineas:** 157-196

```typescript
// ANTES (lineas 177-189):
await prisma.appointment.update({
  where: { id: appointmentId },
  data: { reminderSentAt: new Date() },
});

// ... luego envia email ...
const sent = await sendEmail(appt.providerEmail, subject, html, "ALERT");

// DESPUES:
const sent = await sendEmail(appt.providerEmail, subject, html, "ALERT");
if (sent) {
  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { reminderSentAt: new Date() },
  });
  console.log(`[PROVIDER-EMAIL] Reminder sent to ${appt.providerEmail}`);
}
return sent;
```

---

### Fix A4: Bloqueo en cron de recordatorios

**Archivo:** `server/services/provider-email-service.ts`
**Lineas:** 221-241

```typescript
// DESPUES (usar UPDATE ... WHERE para atomicidad):
export async function runReminderCheck(): Promise<number> {
  const now = new Date();
  const reminderWindowStart = new Date(now.getTime() + 46 * 60 * 60 * 1000);
  const reminderWindowEnd = new Date(now.getTime() + 50 * 60 * 60 * 1000);

  // Atomic: solo seleccionar y marcar en una sola operacion
  const appointments = await prisma.appointment.findMany({
    where: {
      confirmationStatus: { not: "cancelled" },
      providerEmail: { not: null },
      reminderSentAt: null,
      startUtc: { gte: reminderWindowStart, lte: reminderWindowEnd },
    },
  });

  let sent = 0;
  for (const appt of appointments) {
    // Intentar marcar atomicamente (si ya fue marcado por otro proceso, skip)
    const updated = await prisma.appointment.updateMany({
      where: { id: appt.id, reminderSentAt: null },
      data: { reminderSentAt: new Date() },
    });
    if (updated.count === 0) continue; // Otro proceso ya lo tomo

    const ok = await sendAppointmentReminder(appt.id);
    if (!ok) {
      // Revertir marca si fallo
      await prisma.appointment.update({
        where: { id: appt.id },
        data: { reminderSentAt: null },
      });
    } else {
      sent++;
    }
  }
  return sent;
}
```

**Nota:** `sendAppointmentReminder` ya no deberia marcar `reminderSentAt` — mover esa logica aqui.

---

### Fix A5: Escapar HTML en pagina de confirmacion

**Archivo:** `server/routes.ts`
**Lineas:** 281-354

Agregar funcion de escape y usarla:

```typescript
// Agregar antes de buildConfirmationPage:
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Luego en buildConfirmationPage, reemplazar TODAS las interpolaciones de datos del usuario:
// ANTES:
${appt.providerName}
${appt.goodsType}
${appt.cancellationReason}

// DESPUES:
${escapeHtml(appt.providerName)}
${escapeHtml(appt.goodsType || "")}
${escapeHtml(appt.cancellationReason || "")}
```

**Tambien aplicar** en `provider-email-service.ts` lineas 51-58 (appointmentSummaryHtml) y en las plantillas de email.

---

### Fix A6: Impedir cancelar cita confirmada sin verificacion

**Archivo:** `server/routes.ts`
**Lineas:** 254-268

```typescript
// ANTES (lineas 254-256):
if (appt.confirmationStatus === "cancelled") {
  return res.status(400).json({ success: false, error: "Esta cita ya fue anulada" });
}

// DESPUES:
if (appt.confirmationStatus === "cancelled") {
  return res.status(400).json({ success: false, error: "Esta cita ya fue anulada" });
}

// Permitir cancelar confirmada (es un caso valido - proveedor necesita anular)
// pero NO permitir confirmar una ya cancelada
if (appt.confirmationStatus === "confirmed" && data.action === "confirm") {
  return res.json({ success: true, status: "already_confirmed", message: "La cita ya estaba confirmada" });
}
```

**Nota:** Tras reflexion, cancelar una cita confirmada SI es un caso de uso valido (el proveedor confirmo pero luego necesita anular). Lo que hay que mejorar es el double-confirm (A6 se reduce a mejorar el status code del double-confirm).

---

### Fix A7: Validacion Zod para refresh token

**Archivo:** `server/routes.ts`
**Lineas:** 446-467

```typescript
// Agregar schema en shared/types.ts:
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

// ANTES en routes.ts:
const { refreshToken } = req.body;
if (!refreshToken) {
  return res.status(400).json({ error: "Refresh token required" });
}

// DESPUES:
const { refreshToken } = refreshTokenSchema.parse(req.body);
```

---

## MEDIOS

### Fix M1: Rate limiting en endpoints publicos

**Archivo:** `server/routes.ts`

```typescript
// Agregar antes de las rutas publicas:
import rateLimit from "express-rate-limit";

const publicConfirmLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 30, // max 30 requests por IP
  message: { success: false, error: "Demasiadas peticiones. Inténtalo en 15 minutos." },
});

// Aplicar a las rutas publicas:
router.get("/api/appointments/confirm/:token", publicConfirmLimiter, async (req, res) => {
router.post("/api/appointments/confirm", publicConfirmLimiter, async (req, res) => {
```

---

### Fix M2: Consistencia null/undefined

**Archivo:** `server/routes.ts`
**Lineas:** 165-166

```typescript
// ANTES:
providerEmail: data.providerEmail ?? undefined,
providerPhone: data.providerPhone ?? undefined,

// DESPUES (usar || null como en el create):
providerEmail: data.providerEmail || null,
providerPhone: data.providerPhone || null,
```

---

### Fix M3: Minimo 1 para workMinutesNeeded

**Archivo:** `shared/types.ts`
**Linea:** 86

```typescript
// ANTES:
workMinutesNeeded: z.coerce.number().int().min(0),

// DESPUES:
workMinutesNeeded: z.coerce.number().int().min(1),
```

---

### Fix M4: Validar parametro date en slots/availability

**Archivo:** `server/routes.ts`
**Linea:** ~956

```typescript
// ANTES:
const targetDate = new Date(date as string);

// DESPUES:
const targetDate = new Date(date as string);
if (isNaN(targetDate.getTime())) {
  return res.status(400).json({ error: "Invalid date format" });
}
```

---

### Fix M5: Agregar refine a createSlotOverrideSchema

**Archivo:** `shared/types.ts`
**Lineas:** 167-174

```typescript
// ANTES:
export const createSlotOverrideSchema = z.object({
  date: z.string().datetime(),
  dateEnd: z.string().datetime().optional(),
  ...
});

// DESPUES:
export const createSlotOverrideSchema = z.object({
  date: z.string().datetime(),
  dateEnd: z.string().datetime().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  maxPoints: z.number().int().min(0).default(0),
  reason: z.string().optional(),
}).refine(
  data => !data.dateEnd || new Date(data.dateEnd) >= new Date(data.date),
  {
    message: "dateEnd must be >= date",
    path: ["dateEnd"],
  }
);
```

---

### Fix M6: Validacion email en frontend

**Archivo:** `client/src/components/appointment-dialog.tsx`
**Lineas:** 194-237

```typescript
// Agregar dentro de validate(), despues de las otras validaciones:
if (formData.providerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.providerEmail)) {
  newErrors.providerEmail = "Formato de email no válido";
}
```

Y agregar `providerEmail?: string;` al interface `FormErrors`.

---

### Fix M7: Rechazar citas en domingo

**Archivo:** `server/routes.ts`
**Linea:** ~1065 (POST /api/appointments)

```typescript
// Agregar despues de parsear los datos:
import { getMadridDayOfWeek } from "./utils/madrid-date";

const startDate = new Date(data.start);
if (getMadridDayOfWeek(startDate) === 0) {
  return res.status(400).json({
    error: "No se aceptan citas en domingo. El almacén está cerrado."
  });
}
```

---

### Fix M8: Double-confirm devuelve 409

**Archivo:** `server/routes.ts`
**Linea:** 250-252

```typescript
// ANTES:
if (appt.confirmationStatus === "confirmed" && data.action === "confirm") {
  return res.json({ success: true, status: "confirmed", message: "La cita ya estaba confirmada" });
}

// DESPUES:
if (appt.confirmationStatus === "confirmed" && data.action === "confirm") {
  return res.status(200).json({ success: true, status: "already_confirmed", message: "La cita ya estaba confirmada" });
}
```

**Nota:** Mantener 200 es aceptable aqui (idempotencia), pero cambiar `status` a `"already_confirmed"` para que el frontend pueda distinguir.

---

## Orden de Prioridad Recomendado

1. **C1+C2+C3**: Timezone fixes (son el mismo problema raiz)
2. **A5**: XSS escape (seguridad)
3. **A1**: Fecha futura (integridad datos)
4. **A3+A4**: Reminder email fixes (fiabilidad)
5. **M1**: Rate limiting (seguridad)
6. **A2**: estimatedFields parsing (API correctness)
7. **A6+M8**: Confirmation flow improvements
8. **M2-M7**: Remaining medium fixes
