import type {
  AdminCircuitDetail,
  AdminCircuitListItem,
  ApiError,
  CircuitDetail,
  CircuitListQuery,
  CircuitSummary,
  CircuitUpdateBody,
  LoginRequest,
  LoginResponse,
} from '@circuitos/shared';
import { getToken, clearToken } from './auth';

/** Vacío = mismo origen (el proxy de vite en dev, o el reverse proxy en prod). */
export const API_URL: string = import.meta.env.VITE_API_URL ?? '';

export class RequestError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1${path}`, init);
  if (!res.ok) {
    let error: ApiError | null = null;
    try {
      error = (await res.json()) as ApiError;
    } catch {
      // respuesta no JSON
    }
    if (res.status === 401) clearToken();
    throw new RequestError(
      res.status,
      error?.code ?? 'ERROR',
      error?.message ?? `Error ${res.status}`,
    );
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

export const api = {
  listCircuits(query: CircuitListQuery): Promise<CircuitSummary[]> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) params.set(key, String(value));
    }
    const qs = params.toString();
    return request(`/circuits${qs ? `?${qs}` : ''}`);
  },

  circuitDetail(slug: string): Promise<CircuitDetail> {
    return request(`/circuits/${encodeURIComponent(slug)}`);
  },

  login(body: LoginRequest): Promise<LoginResponse> {
    return request('/auth/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  admin: {
    list(): Promise<AdminCircuitListItem[]> {
      return request('/admin/circuits', { headers: authHeaders() });
    },

    detail(id: string): Promise<AdminCircuitDetail> {
      return request(`/admin/circuits/${id}`, { headers: authHeaders() });
    },

    create(form: FormData): Promise<{ id: string; slug: string }> {
      return request('/admin/circuits', { method: 'POST', headers: authHeaders(), body: form });
    },

    update(id: string, body: CircuitUpdateBody): Promise<void> {
      return request(`/admin/circuits/${id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    },

    archive(id: string): Promise<void> {
      return request(`/admin/circuits/${id}`, { method: 'DELETE', headers: authHeaders() });
    },

    uploadMedia(id: string, file: File): Promise<{ url: string }> {
      const form = new FormData();
      form.append('file', file);
      return request(`/admin/circuits/${id}/media`, {
        method: 'POST',
        headers: authHeaders(),
        body: form,
      });
    },
  },
};
