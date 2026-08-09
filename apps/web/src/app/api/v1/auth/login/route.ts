import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { queryOne } from '@expressmx/database';
import type { Usuario } from '@expressmx/types';
import { loginSchema } from '@expressmx/validations';
import { defineEndpoint } from '@/lib/api/handler';
import { EmailNotVerifiedError, ForbiddenError, UnauthorizedError } from '@/lib/errors/http-errors';

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '7d';

const ROL_NO_COINCIDE: Record<'cliente' | 'prestador' | 'admin', string> = {
  cliente: 'Esta cuenta no es de cliente. Usa la app correspondiente.',
  prestador: 'Esta cuenta no es de prestador. Usa la app correspondiente.',
  admin: 'Esta cuenta no es de administrador. Inicia sesión desde el panel web.',
};

export const POST = defineEndpoint({
  tag: 'POST /api/v1/auth/login',
  auth: 'public',
  bodySchema: loginSchema,
  handler: async ({ body }) => {
    const usuario = await queryOne<Usuario & { password_hash: string; email_verificado_en: string | null }>(
      `SELECT u.*, c.password_hash, u.email_verificado_en
       FROM usuarios u
       JOIN user_credentials c ON c.user_id = u.id
       WHERE u.email = $1`,
      [body.email]
    );

    if (!usuario) throw new UnauthorizedError('Credenciales incorrectas');

    const valid = await bcrypt.compare(body.password, usuario.password_hash ?? '');
    if (!valid) throw new UnauthorizedError('Credenciales incorrectas');

    if (usuario.rol !== 'admin' && !usuario.email_verificado_en) {
      throw new EmailNotVerifiedError();
    }

    if (!usuario.activo) throw new UnauthorizedError('Credenciales incorrectas');

    if (body.rol_esperado && usuario.rol !== body.rol_esperado) {
      throw new ForbiddenError(ROL_NO_COINCIDE[body.rol_esperado]);
    }

    const token = jwt.sign(
      { sub: usuario.id, email: usuario.email, rol: usuario.rol },
      process.env.JWT_SECRET!,
      { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
    );

    const response = NextResponse.json({
      data: {
        token,
        usuario: {
          id: usuario.id,
          nombre: usuario.nombre,
          apellidos: usuario.apellidos,
          email: usuario.email,
          rol: usuario.rol,
          avatar_url: usuario.avatar_url,
        },
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
