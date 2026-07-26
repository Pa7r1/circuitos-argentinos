// JWT en memoria + sessionStorage (spec de la etapa 1: un solo admin).
let token: string | null = sessionStorage.getItem('admin_token');

export function getToken(): string | null {
  return token;
}

export function setToken(value: string): void {
  token = value;
  sessionStorage.setItem('admin_token', value);
}

export function clearToken(): void {
  token = null;
  sessionStorage.removeItem('admin_token');
}
