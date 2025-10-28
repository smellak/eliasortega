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
} from "@shared/types";

const API_BASE = "/api";

// Auth token management
let authToken: string | null = localStorage.getItem("authToken");

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem("authToken", token);
  } else {
    localStorage.removeItem("authToken");
  }
}

export function getAuthToken() {
  return authToken;
}

export function clearAuth() {
  setAuthToken(null);
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

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 401) {
      clearAuth();
      window.location.href = "/login";
    }
    throw new Error(data.error || "Request failed");
  }

  return data;
}

// Auth API
export const authApi = {
  login: async (input: LoginInput): Promise<AuthResponse> => {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await handleResponse<AuthResponse>(response);
    setAuthToken(data.token);
    localStorage.setItem("currentUser", JSON.stringify(data.user));
    return data;
  },

  me: async (): Promise<UserResponse> => {
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: getHeaders(),
    });
    return handleResponse<UserResponse>(response);
  },

  logout: () => {
    clearAuth();
  },
};

// Providers API
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

// Capacity Shifts API
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

// Appointments API
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

// Users API (admin only)
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
