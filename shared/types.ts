import { z } from "zod";

// User types
export const userRoleSchema = z.enum(["ADMIN", "PLANNER", "BASIC_READONLY"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export interface UserResponse {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  token: string;
  user: UserResponse;
}

// Provider types
export const createProviderSchema = z.object({
  name: z.string().min(1),
  notes: z.string().optional(),
});
export type CreateProviderInput = z.infer<typeof createProviderSchema>;

export const updateProviderSchema = createProviderSchema.partial();
export type UpdateProviderInput = z.infer<typeof updateProviderSchema>;

export interface Provider {
  id: string;
  name: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// Capacity Shift types
const capacityShiftBaseSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
  workers: z.number().int().min(0),
  forklifts: z.number().int().min(0),
  docks: z.number().int().min(0).max(3).optional(),
});

export const createCapacityShiftSchema = capacityShiftBaseSchema.refine(
  data => new Date(data.end) > new Date(data.start), 
  {
    message: "End time must be after start time",
    path: ["end"],
  }
);
export type CreateCapacityShiftInput = z.infer<typeof createCapacityShiftSchema>;

export const updateCapacityShiftSchema = capacityShiftBaseSchema.partial();
export type UpdateCapacityShiftInput = z.infer<typeof updateCapacityShiftSchema>;

export interface CapacityShift {
  id: string;
  startUtc: string;
  endUtc: string;
  workers: number;
  forklifts: number;
  docks: number | null;
  createdAt: string;
  updatedAt: string;
}

// Appointment types
const appointmentBaseSchema = z.object({
  providerId: z.string().optional(),
  providerName: z.string().min(1),
  start: z.string().datetime(),
  end: z.string().datetime(),
  workMinutesNeeded: z.coerce.number().int().min(1),
  forkliftsNeeded: z.coerce.number().int().min(0),
  goodsType: z.string().optional(),
  units: z.coerce.number().int().min(0).optional(),
  lines: z.coerce.number().int().min(0).optional(),
  deliveryNotesCount: z.coerce.number().int().min(0).optional(),
  externalRef: z.string().optional(),
  providerEmail: z.string().email().optional(),
  providerPhone: z.string().optional(),
});

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
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export const updateAppointmentSchema = appointmentBaseSchema.partial();
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;

export interface Appointment {
  id: string;
  providerId: string | null;
  providerName: string;
  startUtc: string;
  endUtc: string;
  workMinutesNeeded: number;
  forkliftsNeeded: number;
  goodsType: string | null;
  units: number | null;
  lines: number | null;
  deliveryNotesCount: number | null;
  externalRef: string | null;
  size: AppointmentSize | null;
  pointsUsed: number | null;
  slotDate: string | null;
  slotStartTime: string | null;
  estimatedFields: string | null;
  providerEmail: string | null;
  providerPhone: string | null;
  confirmationStatus: string;
  confirmationSentAt: string | null;
  reminderSentAt: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  dockId: string | null;
  dockCode: string | null;
  dockName: string | null;
  actualStartUtc: string | null;
  actualEndUtc: string | null;
  actualUnits: number | null;
  checkedInBy: string | null;
  checkedOutBy: string | null;
  actualDurationMin: number | null;
  predictionErrorMin: number | null;
  createdAt: string;
  updatedAt: string;
}

export const appointmentSizeSchema = z.enum(["S", "M", "L"]);
export type AppointmentSize = z.infer<typeof appointmentSizeSchema>;

// Slot Template types
export const createSlotTemplateSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  maxPoints: z.number().int().min(0).default(6),
  active: z.boolean().default(true),
});
export type CreateSlotTemplateInput = z.infer<typeof createSlotTemplateSchema>;

export const updateSlotTemplateSchema = createSlotTemplateSchema.partial();
export type UpdateSlotTemplateInput = z.infer<typeof updateSlotTemplateSchema>;

export interface SlotTemplate {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  maxPoints: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// Slot Override types
const slotOverrideBaseSchema = z.object({
  date: z.string().datetime(),
  dateEnd: z.string().datetime().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  maxPoints: z.number().int().min(0).default(0),
  reason: z.string().optional(),
});

export const createSlotOverrideSchema = slotOverrideBaseSchema.refine(
  data => !data.dateEnd || new Date(data.dateEnd) >= new Date(data.date),
  {
    message: "dateEnd must be >= date",
    path: ["dateEnd"],
  }
);
export type CreateSlotOverrideInput = z.infer<typeof createSlotOverrideSchema>;

export const updateSlotOverrideSchema = slotOverrideBaseSchema.partial();
export type UpdateSlotOverrideInput = z.infer<typeof updateSlotOverrideSchema>;

export interface SlotOverride {
  id: string;
  date: string;
  dateEnd: string | null;
  startTime: string | null;
  endTime: string | null;
  maxPoints: number;
  reason: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
}

// Dock types
export interface Dock {
  id: string;
  name: string;
  code: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export const createDockSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(10),
  sortOrder: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});
export type CreateDockInput = z.infer<typeof createDockSchema>;

export const updateDockSchema = createDockSchema.partial();
export type UpdateDockInput = z.infer<typeof updateDockSchema>;

export interface DockSlotAvailability {
  id: string;
  dockId: string;
  slotTemplateId: string;
  isActive: boolean;
}

export const updateDockAvailabilitySchema = z.object({
  dockId: z.string(),
  slotTemplateId: z.string(),
  isActive: z.boolean(),
});

export const bulkUpdateDockAvailabilitySchema = z.object({
  updates: z.array(updateDockAvailabilitySchema),
});
export type BulkUpdateDockAvailabilityInput = z.infer<typeof bulkUpdateDockAvailabilitySchema>;

export interface DockOverride {
  id: string;
  dockId: string;
  date: string;
  dateEnd: string | null;
  isActive: boolean;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

export const createDockOverrideSchema = z.object({
  dockId: z.string(),
  date: z.string().datetime(),
  dateEnd: z.string().datetime().optional(),
  isActive: z.boolean().default(false),
  reason: z.string().optional(),
}).refine(
  data => !data.dateEnd || new Date(data.dateEnd) >= new Date(data.date),
  { message: "dateEnd must be >= date", path: ["dateEnd"] },
);
export type CreateDockOverrideInput = z.infer<typeof createDockOverrideSchema>;

// Slot Capacity Conflict
export interface SlotCapacityConflict {
  slotDate: string;
  slotStartTime: string;
  slotEndTime: string;
  pointsUsed: number;
  maxPoints: number;
  pointsRequested: number;
}

// Email Recipient types
export const createEmailRecipientSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  receivesDailySummary: z.boolean().optional().default(true),
  receivesAlerts: z.boolean().optional().default(true),
  receivesUrgent: z.boolean().optional().default(true),
  active: z.boolean().optional().default(true),
});
export type CreateEmailRecipientInput = z.infer<typeof createEmailRecipientSchema>;

export const updateEmailRecipientSchema = createEmailRecipientSchema.partial();
export type UpdateEmailRecipientInput = z.infer<typeof updateEmailRecipientSchema>;

export interface EmailRecipient {
  id: string;
  email: string;
  name: string;
  receivesDailySummary: boolean;
  receivesAlerts: boolean;
  receivesUrgent: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// Email Log types
export const emailTypeSchema = z.enum(["DAILY_SUMMARY", "ALERT"]);
export type EmailType = z.infer<typeof emailTypeSchema>;

export const emailStatusSchema = z.enum(["SENT", "FAILED", "RETRYING"]);
export type EmailStatus = z.infer<typeof emailStatusSchema>;

export interface EmailLog {
  id: string;
  recipientEmail: string;
  type: EmailType;
  subject: string;
  status: EmailStatus;
  sentAt: string | null;
  error: string | null;
  createdAt: string;
}

// Audit Log types
export const auditActionSchema = z.enum(["CREATE", "UPDATE", "DELETE"]);
export type AuditAction = z.infer<typeof auditActionSchema>;

export const actorTypeSchema = z.enum(["USER", "CHAT_AGENT", "INTEGRATION", "SYSTEM"]);
export type ActorType = z.infer<typeof actorTypeSchema>;

export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  actorType: ActorType;
  actorId: string | null;
  changes: Record<string, unknown> | null;
  createdAt: string;
}

// Capacity validation error
/** @deprecated Use SlotConflictError instead */
export interface CapacityConflictError {
  minute: string; // ISO string in UTC
  minuteMadrid: string; // formatted for Europe/Madrid
  workUsed: number;
  workAvailable: number;
  forkliftsUsed: number;
  forkliftsAvailable: number;
  docksUsed?: number;
  docksAvailable?: number;
  failedRule: "work" | "forklifts" | "docks";
}

// Slot-based capacity conflict error (v2.0)
export interface SlotConflictError {
  slotStartTime: string;
  slotEndTime: string;
  maxPoints: number;
  pointsUsed: number;
  pointsNeeded: number;
  reason: 'NO_POINTS' | 'NO_DOCK';
  message: string; // human-readable Spanish error
}

// Capacity utilization
/** @deprecated Use SlotUtilization instead */
export interface CapacityUtilization {
  appointmentCount: number;
  capacityPercentage: number;
  workersPercentage: number;
  forkliftsPercentage: number;
  docksPercentage: number;
  peakDay: string | null;
  peakPercentage: number;
  daysUsingDefaults: number;
  defaultDaysBreakdown: {
    sundays: number;
    saturdays: number;
    weekdays: number;
  };
  breakdown: {
    workers: { used: number; available: number };
    forklifts: { used: number; available: number };
    docks: { used: number; available: number };
  };
}

// Slot-based capacity utilization (v2.0)
export interface SlotUtilization {
  appointmentCount: number;
  slots: Array<{
    date: string;
    startTime: string;
    endTime: string;
    maxPoints: number;
    pointsUsed: number;
    pointsAvailable: number;
  }>;
  totalMaxPoints: number;
  totalPointsUsed: number;
  utilizationPercentage: number;
  peakSlot: { date: string; startTime: string; percentage: number } | null;
}

// Integration types
export const upsertAppointmentSchema = appointmentBaseSchema.extend({
  externalRef: z.string().min(1), // Required for upsert
}).refine(
  data => new Date(data.end) > new Date(data.start), 
  {
    message: "End time must be after start time",
    path: ["end"],
  }
);
export type UpsertAppointmentInput = z.infer<typeof upsertAppointmentSchema>;

// Calendar parse types (for n8n integration)
export const rawCalendarQuerySchema = z.object({
  action: z.string(),
  from: z.string().optional(),
  to: z.string().optional(),
  duration_minutes: z.coerce.number().int().min(0).optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  providerName: z.string().optional(),
  goodsType: z.string().optional(),
  units: z.coerce.number().int().min(0).optional(),
  lines: z.coerce.number().int().min(0).optional(),
  deliveryNotesCount: z.coerce.number().int().min(0).optional(),
  workMinutesNeeded: z.coerce.number().int().min(0).optional(),
  forkliftsNeeded: z.coerce.number().int().min(0).optional(),
  providerEmail: z.string().email().optional(),
  providerPhone: z.string().optional(),
});
export type RawCalendarQuery = z.infer<typeof rawCalendarQuerySchema>;

export interface NormalizedCalendarQuery {
  action: "availability" | "book";
  from: string;
  to: string;
  duration_minutes: number;
  start: string;
  end: string;
  providerName: string;
  goodsType: string;
  units: number;
  lines: number;
  deliveryNotesCount: number;
  workMinutesNeeded: number;
  forkliftsNeeded: number;
  providerEmail: string;
  providerPhone: string;
}

// Appointment confirmation (public)
export const confirmAppointmentSchema = z.object({
  token: z.string().min(1),
  action: z.enum(["confirm", "cancel"]),
  reason: z.string().optional(),
});
export type ConfirmAppointmentInput = z.infer<typeof confirmAppointmentSchema>;
