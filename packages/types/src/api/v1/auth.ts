import type {
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from '@expressmx/validations';
import type { RolUsuario } from '../../index';
import type { DataResponse } from './common';

export type LoginRequest = LoginInput;

export interface SessionUser {
  id: string;
  nombre: string;
  apellidos: string;
  email: string;
  rol: RolUsuario;
  avatar_url: string | null;
}

export interface LoginPayload {
  token: string;
  usuario: SessionUser;
}
export type LoginResponse = DataResponse<LoginPayload>;

export type LogoutResponse = DataResponse<{ ok: true }>;

export interface MeUser extends SessionUser {
  telefono: string | null;
  activo: boolean;
}
export type MeResponse = DataResponse<MeUser>;

export type ForgotPasswordRequest = ForgotPasswordInput;
export type ForgotPasswordResponse = DataResponse<{ message: string }>;

export type ResetPasswordRequest = ResetPasswordInput;
export type ResetPasswordResponse = DataResponse<{ message: string }>;
