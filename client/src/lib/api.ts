import type {
  AuthResponse,
  LoginInput,
  Provider,
  CreateProviderInput,
  UpdateProviderInput,
  CapacityShift,
  CreateCapacityShiftInput,
  UpdateCapacityShiftInput,
  Appointment,
  CreateAppointmentInput,
  UpdateAppointmentInput,
  UserResponse,
  SlotUtilization,
  SlotTemplate,
  CreateSlotTemplateInput,
  UpdateSlotTemplateInput,
  SlotOverride,
  CreateSlotOverrideInput,
  UpdateSlotOverrideInput,
  EmailRecipient,
  CreateEmailRecipientInput,
  UpdateEmailRecipientInput,
  EmailLog,
  AuditLog,
} from "@shared/types";

const API_BASE = "/api";

let authToken: string | null = localStorage.getItem("authToken");
let refreshToken: string | null = localStorage.getItem("refreshToken");

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem("authToken", token);
  } else {
    localStorage.removeItem("authToken");
  }
}

export function setRefreshToken(token: string | null) {
  refreshToken = token;
  if (token) {
    localStorage.setItem("refreshToken", token);
  } else {
    localStorage.removeItem("refreshToken");
  }
}

export function getAuthToken() {
  return authToken;
}

export function clearAuth() {
  setAuthToken(null);
  setRefreshToken(null);
  localStorage.removeItem("currentUser");
}

function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  return headers;
}

async function tryRefreshToken(): Promise<boolean> {
  if (!refreshToken) return false;
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) return false;
    const data = await response.json();
    setAuthToken(data.token);
    if (data.refreshToken) setRefreshToken(data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

async function handleResponse<T>(response: Response, retryFn?: () => Promise<Response>): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  if (response.status === 401 && retryFn) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      const retryResponse = await retryFn();
      return handleResponse<T>(retryResponse);
    }
    clearAuth();
    window.location.href = "/login";
    throw new Error("Session expired");
  }

  const text = await response.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      !response.ok
        ? `Error del servidor (${response.status})`
        : "Respuesta inesperada del servidor"
    );
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearAuth();
      window.location.href = "/login";
    }
    throw new Error(data.error || data.message || "Request failed");
  }

  return data;
}

export const authApi = {
  login: async (input: LoginInput): Promise<AuthResponse> => {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await handleResponse<AuthResponse & { refreshToken?: string }>(response);
    setAuthToken(data.token);
    if (data.refreshToken) setRefreshToken(data.refreshToken);
    localStorage.setItem("currentUser", JSON.stringify(data.user));
    return data;
  },

  me: async (): Promise<UserResponse> => {
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: getHeaders(),
    });
    return handleResponse<UserResponse>(response, () =>
      fetch(`${API_BASE}/auth/me`, { headers: getHeaders() })
    );
  },

  logout: async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: getHeaders(),
      });
    } catch {
      // Best-effort: server-side invalidation may fail if token expired
    }
    clearAuth();
  },

  changePassword: async (input: { currentPassword: string; newPassword: string }): Promise<{ message: string }> => {
    const response = await fetch(`${API_BASE}/auth/change-password`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(input),
    });
    return handleResponse(response, () =>
      fetch(`${API_BASE}/auth/change-password`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify(input),
      })
    );
  },
};

export const providersApi = {
  list: async (): Promise<Provider[]> => {
    const response = await fetch(`${API_BASE}/providers`, {
      headers: getHeaders(),
    });
    return handleResponse<Provider[]>(response);
  },

  create: async (input: CreateProviderInput): Promise<Provider> => {
    const response = await fetch(`${API_BASE}/providers`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(input),
    });
    return handleResponse<Provider>(response);
  },

  update: async (id: string, input: UpdateProviderInput): Promise<Provider> => {
    const response = await fetch(`${API_BASE}/providers/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(input),
    });
    return handleResponse<Provider>(response);
  },

  delete: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/providers/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    return handleResponse<void>(response);
  },
};

export const capacityShiftsApi = {
  list: async (params?: { from?: string; to?: string }): Promise<CapacityShift[]> => {
    const query = new URLSearchParams();
    if (params?.from) query.append("from", params.from);
    if (params?.to) query.append("to", params.to);

    const response = await fetch(`${API_BASE}/capacity-shifts?${query}`, {
      headers: getHeaders(),
    });
    return handleResponse<CapacityShift[]>(response);
  },

  create: async (input: CreateCapacityShiftInput): Promise<CapacityShift> => {
    const response = await fetch(`${API_BASE}/capacity-shifts`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(input),
    });
    return handleResponse<CapacityShift>(response);
  },

  update: async (id: string, input: UpdateCapacityShiftInput): Promise<CapacityShift> => {
    const response = await fetch(`${API_BASE}/capacity-shifts/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(input),
    });
    return handleResponse<CapacityShift>(response);
  },

  delete: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/capacity-shifts/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    return handleResponse<void>(response);
  },
};

export const appointmentsApi = {
  list: async (params?: {
    from?: string;
    to?: string;
    providerId?: string;
  }): Promise<Appointment[]> => {
    const query = new URLSearchParams();
    if (params?.from) query.append("from", params.from);
    if (params?.to) query.append("to", params.to);
    if (params?.providerId) query.append("providerId", params.providerId);

    const response = await fetch(`${API_BASE}/appointments?${query}`, {
      headers: getHeaders(),
    });
    return handleResponse<Appointment[]>(response);
  },

  create: async (input: CreateAppointmentInput): Promise<Appointment> => {
    const response = await fetch(`${API_BASE}/appointments`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(input),
    });
    return handleResponse<Appointment>(response);
  },

  update: async (id: string, input: UpdateAppointmentInput): Promise<Appointment> => {
    const response = await fetch(`${API_BASE}/appointments/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(input),
    });
    return handleResponse<Appointment>(response);
  },

  delete: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/appointments/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    return handleResponse<void>(response);
  },

  getCapacityAtMinute: async (minute: string): Promise<{
    workUsed: number;
    workAvailable: number;
    forkliftsUsed: number;
    forkliftsAvailable: number;
    docksUsed: number;
    docksAvailable: number;
  }> => {
    const response = await fetch(`${API_BASE}/capacity/at-minute?minute=${encodeURIComponent(minute)}`, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },
};

export interface TodayStatusResponse {
  date: string;
  quickAdjustLevel: "normal" | "slightly_less" | "much_less" | "minimum" | "slightly_more";
  slots: Array<{
    startTime: string;
    endTime: string;
    maxPoints: number;
    usedPoints: number;
    availablePoints: number;
  }>;
}

export interface QuickAdjustResponse {
  date: string;
  level: string;
  adjustedSlots: Array<{
    startTime: string;
    endTime: string;
    originalPoints: number;
    newPoints: number;
  }>;
}

export const capacityApi = {
  getUtilization: async (params: { startDate: string; endDate: string }): Promise<SlotUtilization> => {
    const query = new URLSearchParams();
    query.append("startDate", params.startDate);
    query.append("endDate", params.endDate);

    const response = await fetch(`${API_BASE}/capacity/utilization?${query}`, {
      headers: getHeaders(),
    });
    return handleResponse<SlotUtilization>(response);
  },

  getTodayStatus: async (date?: string): Promise<TodayStatusResponse> => {
    const query = new URLSearchParams();
    if (date) query.append("date", date);

    const response = await fetch(`${API_BASE}/capacity/today-status?${query}`, {
      headers: getHeaders(),
    });
    return handleResponse<TodayStatusResponse>(response, () =>
      fetch(`${API_BASE}/capacity/today-status?${query}`, { headers: getHeaders() })
    );
  },

  quickAdjust: async (params: {
    date?: string;
    level: "slightly_less" | "much_less" | "minimum" | "slightly_more" | "reset";
  }): Promise<QuickAdjustResponse> => {
    const response = await fetch(`${API_BASE}/capacity/quick-adjust`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(params),
    });
    return handleResponse<QuickAdjustResponse>(response, () =>
      fetch(`${API_BASE}/capacity/quick-adjust`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(params),
      })
    );
  },
};

export const usersApi = {
  list: async (): Promise<UserResponse[]> => {
    const response = await fetch(`${API_BASE}/users`, {
      headers: getHeaders(),
    });
    return handleResponse<UserResponse[]>(response);
  },

  create: async (input: {
    email: string;
    password: string;
    role: "ADMIN" | "PLANNER" | "BASIC_READONLY";
  }): Promise<UserResponse> => {
    const response = await fetch(`${API_BASE}/users`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(input),
    });
    return handleResponse<UserResponse>(response);
  },

  update: async (id: string, input: { email?: string; role?: string }): Promise<UserResponse> => {
    const response = await fetch(`${API_BASE}/users/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(input),
    });
    return handleResponse<UserResponse>(response);
  },

  delete: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/users/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    return handleResponse<void>(response);
  },
};

export const slotTemplatesApi = {
  list: async (): Promise<SlotTemplate[]> => {
    const response = await fetch(`${API_BASE}/slot-templates`, {
      headers: getHeaders(),
    });
    return handleResponse<SlotTemplate[]>(response);
  },

  create: async (input: CreateSlotTemplateInput): Promise<SlotTemplate> => {
    const response = await fetch(`${API_BASE}/slot-templates`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(input),
    });
    return handleResponse<SlotTemplate>(response);
  },

  update: async (id: string, input: UpdateSlotTemplateInput): Promise<SlotTemplate> => {
    const response = await fetch(`${API_BASE}/slot-templates/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(input),
    });
    return handleResponse<SlotTemplate>(response);
  },

  delete: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/slot-templates/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    return handleResponse<void>(response);
  },
};

export const slotOverridesApi = {
  list: async (params?: { from?: string; to?: string }): Promise<SlotOverride[]> => {
    const query = new URLSearchParams();
    if (params?.from) query.append("from", params.from);
    if (params?.to) query.append("to", params.to);

    const response = await fetch(`${API_BASE}/slot-overrides?${query}`, {
      headers: getHeaders(),
    });
    return handleResponse<SlotOverride[]>(response);
  },

  create: async (input: CreateSlotOverrideInput): Promise<SlotOverride> => {
    const response = await fetch(`${API_BASE}/slot-overrides`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(input),
    });
    return handleResponse<SlotOverride>(response);
  },

  update: async (id: string, input: UpdateSlotOverrideInput): Promise<SlotOverride> => {
    const response = await fetch(`${API_BASE}/slot-overrides/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(input),
    });
    return handleResponse<SlotOverride>(response);
  },

  delete: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/slot-overrides/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    return handleResponse<void>(response);
  },
};

export interface WeekSlotAppointment {
  id: string;
  providerName: string;
  goodsType: string | null;
  units: number | null;
  lines: number | null;
  deliveryNotesCount: number | null;
  size: string | null;
  pointsUsed: number | null;
  workMinutesNeeded: number;
  startUtc: string;
  endUtc: string;
}

export interface WeekSlot {
  startTime: string;
  endTime: string;
  maxPoints: number;
  usedPoints: number;
  availablePoints: number;
  appointments: WeekSlotAppointment[];
}

export interface WeekDay {
  date: string;
  dayOfWeek: number;
  dayName: string;
  slots: WeekSlot[];
}

export const slotsApi = {
  getWeek: async (date: string): Promise<WeekDay[]> => {
    const query = new URLSearchParams();
    query.append("date", date);

    const response = await fetch(`${API_BASE}/slots/week?${query}`, {
      headers: getHeaders(),
    });
    return handleResponse<WeekDay[]>(response, () =>
      fetch(`${API_BASE}/slots/week?${query}`, { headers: getHeaders() })
    );
  },

  getAvailability: async (params: { date: string; points?: number }): Promise<Array<{
    startTime: string;
    endTime: string;
    maxPoints: number;
    pointsUsed: number;
    pointsAvailable: number;
    isOverride: boolean;
  }>> => {
    const query = new URLSearchParams();
    query.append("date", params.date);
    if (params.points) query.append("points", String(params.points));

    const response = await fetch(`${API_BASE}/slots/availability?${query}`, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  getUsage: async (params: { from: string; to: string }): Promise<Array<{
    date: string;
    slots: Array<{
      startTime: string;
      endTime: string;
      maxPoints: number;
      pointsUsed: number;
      pointsAvailable: number;
    }>;
  }>> => {
    const query = new URLSearchParams();
    query.append("from", params.from);
    query.append("to", params.to);

    const response = await fetch(`${API_BASE}/slots/usage?${query}`, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },
};

export const emailRecipientsApi = {
  list: async (): Promise<EmailRecipient[]> => {
    const response = await fetch(`${API_BASE}/email-recipients`, {
      headers: getHeaders(),
    });
    return handleResponse<EmailRecipient[]>(response);
  },

  create: async (input: CreateEmailRecipientInput): Promise<EmailRecipient> => {
    const response = await fetch(`${API_BASE}/email-recipients`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(input),
    });
    return handleResponse<EmailRecipient>(response);
  },

  update: async (id: string, input: UpdateEmailRecipientInput): Promise<EmailRecipient> => {
    const response = await fetch(`${API_BASE}/email-recipients/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(input),
    });
    return handleResponse<EmailRecipient>(response);
  },

  delete: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/email-recipients/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    return handleResponse<void>(response);
  },
};

export const emailApi = {
  getLog: async (params?: { page?: number; limit?: number }): Promise<{ logs: EmailLog[]; total: number }> => {
    const query = new URLSearchParams();
    if (params?.page) query.append("page", String(params.page));
    if (params?.limit) query.append("limit", String(params.limit));

    const response = await fetch(`${API_BASE}/email-log?${query}`, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  sendTest: async (to: string): Promise<{ success: boolean }> => {
    const response = await fetch(`${API_BASE}/email/test`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ to }),
    });
    return handleResponse(response);
  },
};

export const auditApi = {
  list: async (params?: {
    entityType?: string;
    action?: string;
    actorType?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }): Promise<{ logs: AuditLog[]; total: number }> => {
    const query = new URLSearchParams();
    if (params?.entityType) query.append("entityType", params.entityType);
    if (params?.action) query.append("action", params.action);
    if (params?.actorType) query.append("actorType", params.actorType);
    if (params?.from) query.append("from", params.from);
    if (params?.to) query.append("to", params.to);
    if (params?.page) query.append("page", String(params.page));
    if (params?.limit) query.append("limit", String(params.limit));

    const response = await fetch(`${API_BASE}/audit-log?${query}`, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },
};
