import { z } from "zod";

// User types
export const userRoleSchema = z.enum(["ADMIN", "PLANNER", "BASIC_READONLY"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

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
  workMinutesNeeded: z.number().int().min(0),
  forkliftsNeeded: z.number().int().min(0),
  goodsType: z.string().optional(),
  units: z.number().int().min(0).optional(),
  lines: z.number().int().min(0).optional(),
  deliveryNotesCount: z.number().int().min(0).optional(),
  externalRef: z.string().optional(),
});

export const createAppointmentSchema = appointmentBaseSchema.refine(
  data => new Date(data.end) > new Date(data.start), 
  {
    message: "End time must be after start time",
    path: ["end"],
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
  createdAt: string;
  updatedAt: string;
}

// Capacity validation error
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
