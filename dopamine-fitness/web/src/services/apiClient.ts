export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  requestId?: string;
  message?: string;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
    public readonly requestId?: string
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

const API_BASE = "/api";

function getToken() {
  return localStorage.getItem("df_token");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  // Handle empty body (204 No Content or truly empty error responses)
  const text = await response.text();
  if (!text || text.trim() === "") {
    if (!response.ok) {
      throw new ApiClientError("Request failed (empty response)", response.status);
    }
    return undefined as unknown as T;
  }

  let body: ApiEnvelope<T>;
  try {
    body = JSON.parse(text) as ApiEnvelope<T>;
  } catch {
    throw new ApiClientError(
      `Invalid JSON response: ${text.slice(0, 100)}`,
      response.status,
    );
  }

  if (!response.ok || !body.success) {
    throw new ApiClientError(
      body.error ?? body.message ?? "Request failed",
      response.status,
      body.code,
      body.requestId
    );
  }

  if (body.data === undefined) {
    return undefined as unknown as T;
  }

  return body.data;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, payload?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: payload ? JSON.stringify(payload) : undefined,
    }),
  patch: <T>(path: string, payload: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(payload) }),
  delete: <T>(path: string, payload?: unknown) =>
    request<T>(path, {
      method: "DELETE",
      body: payload ? JSON.stringify(payload) : undefined,
    }),
};
