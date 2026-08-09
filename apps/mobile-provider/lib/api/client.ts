import * as SecureStore from 'expo-secure-store';

const tokenKey = 'expressmx.provider.auth_token';
const baseUrl = resolveBaseUrl();

function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (!fromEnv) {
    throw new Error('EXPO_PUBLIC_API_URL is required (set it in .env.local or at build time).');
  }

  const raw = fromEnv.trim().replace(/\/+$/, '');
  const url = new URL(raw);

  if (url.protocol !== 'https:') {
    throw new Error('EXPO_PUBLIC_API_URL must be an HTTPS URL.');
  }

  return raw;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function readToken(): Promise<string | null> {
  return SecureStore.getItemAsync(tokenKey);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await readToken();
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((init.headers as Record<string, string>) ?? {}),
  };

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Error desconocido';
    throw new ApiError(
      `No pudimos conectarnos al servidor (${baseUrl}). Detalle: ${detail}.`,
      0,
    );
  }

  const text = await response.text();
  const payload = text ? safeJson(text) : null;

  if (!response.ok) {
    const errBody = payload as
      | { error?: string | { message?: string; code?: string; details?: unknown }; code?: string; details?: unknown }
      | null;
    const rawError = errBody?.error;
    const message =
      typeof rawError === 'string'
        ? rawError
        : rawError?.message ?? defaultMessageForStatus(response.status);
    const code =
      typeof rawError === 'string' ? errBody?.code : rawError?.code ?? errBody?.code;
    const details =
      typeof rawError === 'string' ? errBody?.details : rawError?.details ?? errBody?.details;
    throw new ApiError(message, response.status, code, details);
  }

  return payload as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function defaultMessageForStatus(status: number): string {
  if (status === 400) return 'Revisa los datos e inténtalo de nuevo.';
  if (status === 401) return 'Necesitas iniciar sesión otra vez.';
  if (status === 403) return 'No tienes permiso para hacer esto.';
  if (status === 404) return 'No encontramos lo que buscas.';
  if (status === 409) return 'Ya existe un registro con esos datos.';
  if (status === 422) return 'Algunos datos no son válidos.';
  if (status >= 500) return 'El servidor está fallando, inténtalo más tarde.';
  return 'No pudimos procesar tu solicitud.';
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  postForm: <T>(path: string, form: FormData) =>
    request<T>(path, { method: 'POST', body: form }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }),
};

export const apiBaseUrl = baseUrl;
