import * as SecureStore from 'expo-secure-store';
import { apiBaseUrl } from '@/lib/api/client';

const BASE_URL = apiBaseUrl;

export interface AuthUser {
  id: string;
  nombre: string;
  apellidos: string;
  email: string;
  rol: string;
  avatar_url: string | null;
}

const TOKEN_KEY = 'expressmx.provider.auth_token';
const USER_KEY = 'expressmx.provider.auth_user';

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${BASE_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, rol_esperado: 'prestador' }),
  });

  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    const errorObj =
      typeof payload?.error === 'object' && payload?.error ? payload.error : null;
    const message =
      (errorObj?.message as string | undefined) ?? (payload?.error as string | undefined);
    const err = new Error(message ?? 'Credenciales incorrectas') as Error & { code?: string };
    err.code = errorObj?.code as string | undefined;
    throw err;
  }

  const token: string = payload.data.token;
  const usuario: AuthUser = payload.data.usuario;

  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(usuario));

  return usuario;
}

export async function logout(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ]);
}

export async function getStoredUser(): Promise<AuthUser | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}
