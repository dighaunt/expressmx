import * as SecureStore from 'expo-secure-store';
import { api, ApiError } from '../api/client';

const tokenKey = 'expressmx.auth_token';
const userKey = 'expressmx.auth_user';

export interface SessionUser {
  id: string;
  nombre: string;
  apellidos: string;
  email: string;
  telefono?: string | null;
  rol: 'cliente' | 'prestador' | 'admin';
  avatar_url: string | null;
}

interface LoginResponse {
  data: {
    token: string;
    usuario: SessionUser;
  };
}

interface MeResponse {
  data: SessionUser & { telefono: string | null; activo: boolean };
}

export async function signIn(email: string, password: string): Promise<SessionUser> {
  const result = await api.post<LoginResponse>('/v1/auth/login', {
    email,
    password,
    rol_esperado: 'cliente',
  });
  await SecureStore.setItemAsync(tokenKey, result.data.token);
  await SecureStore.setItemAsync(userKey, JSON.stringify(result.data.usuario));
  return result.data.usuario;
}

export async function signOut(): Promise<void> {
  try {
    await api.post('/v1/auth/logout');
  } catch {
    void 0;
  }
  await Promise.all([
    SecureStore.deleteItemAsync(tokenKey),
    SecureStore.deleteItemAsync(userKey),
  ]);
}

export async function getCachedUser(): Promise<SessionUser | null> {
  const raw = await SecureStore.getItemAsync(userKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export async function refreshUser(): Promise<SessionUser | null> {
  try {
    const result = await api.get<MeResponse>('/v1/auth/me');
    await SecureStore.setItemAsync(userKey, JSON.stringify(result.data));
    return result.data;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      await Promise.all([
        SecureStore.deleteItemAsync(tokenKey),
        SecureStore.deleteItemAsync(userKey),
      ]);
    }
    return null;
  }
}

export async function hasActiveSession(): Promise<boolean> {
  const token = await SecureStore.getItemAsync(tokenKey);
  return Boolean(token);
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(tokenKey);
}
