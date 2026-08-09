import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { queryOne } from '@expressmx/database';
import type { Usuario } from '@expressmx/types';
import { loginSchema } from '@expressmx/validations';
import { defineEndpoint } from '@/lib/api/handler';
import { UnauthorizedError, ForbiddenError } from '@/lib/errors/http-errors';

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '7d';

export const POST = defineEndpoint({
  tag: 'POST /api/auth/login',
  auth: 'public',
  bodySchema: loginSchema,
  handler: async ({ body }) => {
    const usuario = await queryOne<Usuario & { password_hash: string }>(
      `SELECT u.*, c.password_hash
       FROM usuarios u
       JOIN user_credentials c ON c.user_id = u.id
       WHERE u.email = $1 AND u.activo = true`,
      [body.email]
    );

    if (!usuario) throw new UnauthorizedError('Credenciales incorrectas');

    const valid = await bcrypt.compare(body.password, usuario.password_hash ?? '');
    if (!valid) throw new UnauthorizedError('Credenciales incorrectas');

    const acceso = await queryOne<{ ok: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM usuarios_admin ua
         JOIN roles_admin ra ON ra.id = ua.rol_id
         WHERE ua.usuario_id = $1 AND ua.activo = TRUE AND ra.activo = TRUE
       ) AS ok`,
      [usuario.id]
    );
    if (!acceso?.ok) {
      throw new ForbiddenError('Tu cuenta no tiene acceso al panel administrativo');
    }

    await queryOne(
      `UPDATE usuarios_admin SET ultimo_acceso = NOW() WHERE usuario_id = $1`,
      [usuario.id]
    );

    const token = jwt.sign(
      { sub: usuario.id, email: usuario.email, rol: usuario.rol },
      process.env.JWT_SECRET!,
      { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
    );

    const response = NextResponse.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellidos: usuario.apellidos,
        email: usuario.email,
        rol: usuario.rol,
        avatar_url: usuario.avatar_url,
      },
    });

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  },
});
