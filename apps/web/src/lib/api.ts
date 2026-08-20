import type {
  AdminCircuitDetail,
  AdminCircuitList,
  AdminStats,
  CircuitStatus,
  ApiError,
  AuthResponse,
  AuthUser,
  CircuitDetail,
  CircuitListQuery,
  CircuitSummary,
  CircuitUpdateBody,
  LoginRequest,
  RegisterRequest,
} from '@circuitos/shared';
import { clearSession, getToken } from './session';

/** Vacío = mismo origen (el proxy de vite en dev, o el reverse proxy en prod). */
export const API_URL: string = import.meta.env.VITE_API_URL ?? '';

export class RequestError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    /** El mensaje lo escribió el servidor para leerse; los inventados acá, no. */
    public readonly delServidor = false,
  ) {
    super(message);
  }
}

/**
 * Qué se le muestra a la persona cuando algo falla.
 *
 * Los errores de dominio ya vienen del servidor redactados en criollo ("Dejanos un
 * teléfono para poder contactarte") y se muestran tal cual. Todo lo demás —códigos
 * internos, fallos de red, respuestas raras— se traduce por familia: quien está
 * cargando un circuito no tiene por qué leer RESPUESTA_NO_JSON, y en producción no
 * queremos filtrar nada técnico. El detalle va a la consola, que es donde sirve.
 */
export function mensajeParaPersona(error: unknown): string {
  console.error(error);
  const generico = 'Algo salió mal. Probá de nuevo en un rato.';

  // fetch solo rechaza con TypeError cuando el pedido ni siquiera llegó: sin
  // internet, o la API dormida (Render gratis se apaga a los 15 minutos)
  if (error instanceof TypeError) {
    return 'No pudimos conectarnos. Fijate si tenés internet; si recién abrís la app, el servidor puede estar despertando y tarda hasta un minuto.';
  }
  if (!(error instanceof RequestError)) return generico;

  if (error.statusCode === 401) return 'Se venció tu sesión. Ingresá de nuevo y reintentá.';
  if (error.statusCode === 413) {
    return 'El archivo pesa demasiado. El máximo son 5 MB: probá con una foto más chica.';
  }
  if (error.statusCode === 429) return 'Fueron muchos intentos seguidos. Esperá un minuto.';
  if (error.code === 'VALIDACION') return 'Revisá los datos: alguno quedó incompleto o mal cargado.';
  if (error.statusCode >= 500 || error.code === 'RESPUESTA_NO_JSON') {
    return 'El servidor no está respondiendo bien. Probá de nuevo en un minuto.';
  }
  return error.delServidor ? error.message : generico;
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
    if (res.status === 401) clearSession();
    throw new RequestError(
      res.status,
      error?.code ?? 'ERROR',
      error?.message ?? `Error ${res.status}`,
      error?.message !== undefined,
    );
  }
  if (res.status === 204) return undefined as T;
  // Si el build salió sin VITE_API_URL, los pedidos van al propio sitio y el
  // servidor de assets contesta el index.html con estado 200. Sin este control,
  // el error sería un fallo de sintaxis de JSON imposible de interpretar.
  if (!res.headers.get('content-type')?.includes('json')) {
    throw new RequestError(
      res.status,
      'RESPUESTA_NO_JSON',
      'La API respondió algo que no es JSON. Si esto pasa en producción, falta VITE_API_URL en el build.',
    );
  }
  return (await res.json()) as T;
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
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
    return request(`/circuits/${encodeURIComponent(slug)}`, { headers: authHeaders() });
  },

  register(body: RegisterRequest): Promise<AuthResponse> {
    return post('/auth/register', body);
  },

  login(body: LoginRequest): Promise<AuthResponse> {
    return post('/auth/login', body);
  },

  me(): Promise<AuthUser> {
    return request('/auth/me', { headers: authHeaders() });
  },

  /** Pide el correo con el enlace. Responde igual exista o no la cuenta. */
  forgotPassword(email: string): Promise<void> {
    return post('/auth/forgot-password', { email });
  },

  resetPassword(token: string, password: string): Promise<void> {
    return post('/auth/reset-password', { token, password });
  },

  deleteAccount(): Promise<void> {
    return request('/auth/me', { method: 'DELETE', headers: authHeaders() });
  },

  /** Descarga el GPX original (requiere sesión) y lo entrega como blob. */
  async downloadGpx(slug: string): Promise<Blob> {
    const res = await fetch(`${API_URL}/api/v1/circuits/${encodeURIComponent(slug)}/gpx`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new RequestError(res.status, 'GPX', 'No se pudo descargar el GPX');
    return res.blob();
  },

  /** Circuito propuesto por alguien con cuenta. Queda esperando revisión en /admin. */
  proponerCircuito(form: FormData): Promise<{ id: string; slug: string }> {
    return request('/circuits/propuestas', { method: 'POST', headers: authHeaders(), body: form });
  },

  /** Foto de una propuesta propia. Van de a una: el multipart admite un archivo por pedido. */
  subirFotoPropuesta(id: string, form: FormData): Promise<{ url: string }> {
    return request(`/circuits/propuestas/${id}/media`, {
      method: 'POST',
      headers: authHeaders(),
      body: form,
    });
  },

  admin: {
    /**
     * Lista paginada del panel. El servidor ordena (publicados, propuestos,
     * archivados y el resto) y devuelve el total junto a la página.
     */
    listPaginado(params: {
      limit?: number;
      offset?: number;
      estado?: CircuitStatus;
      q?: string;
    } = {}): Promise<AdminCircuitList> {
      const query = new URLSearchParams();
      if (params.limit !== undefined) query.set('limit', String(params.limit));
      if (params.offset !== undefined) query.set('offset', String(params.offset));
      if (params.estado) query.set('estado', params.estado);
      if (params.q) query.set('q', params.q);
      const qs = query.toString();
      return request(`/admin/circuits${qs ? `?${qs}` : ''}`, { headers: authHeaders() });
    },

    detail(id: string): Promise<AdminCircuitDetail> {
      return request(`/admin/circuits/${id}`, { headers: authHeaders() });
    },

    stats(): Promise<AdminStats> {
      return request('/admin/stats', { headers: authHeaders() });
    },

    /**
     * Los bytes de una foto del panel, con la sesión de admin.
     *
     * `/media` sirve solo circuitos publicados, así que un `<img src>` plano no
     * alcanza para las fotos de un borrador, una propuesta o algo rechazado: son
     * justo los estados que hay que mirar para decidir qué hacer con ellos. Y como
     * esto va con cabecera de autorización, un `src` no sirve: hay que traer el
     * blob y armar una URL de objeto.
     *
     * De la url guardada (`/media/<id>/<archivo>`) solo se manda el último tramo;
     * la pertenencia la comprueba el servidor contra la base, no comparando texto.
     */
    async foto(id: string, url: string): Promise<Blob> {
      const archivo = url.split('/').pop() ?? '';
      const res = await fetch(`${API_URL}/api/v1/admin/circuits/${id}/media/${archivo}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new RequestError(res.status, 'FOTO_NO_DISPONIBLE', 'No se pudo traer la foto');
      return res.blob();
    },

    removeMedia(id: string, url: string): Promise<void> {
      return request(`/admin/circuits/${id}/media`, {
        method: 'DELETE',
        headers: { ...authHeaders(), 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      });
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

    /**
     * Borrado irreversible: se lleva fotos, GPX y horarios. El servidor solo lo
     * acepta sobre circuitos ya archivados o rechazados.
     */
    borrarDefinitivo(id: string): Promise<void> {
      return request(`/admin/circuits/${id}/definitivo`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
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
