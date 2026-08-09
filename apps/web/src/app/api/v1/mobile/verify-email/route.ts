import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { withTransaction } from '@expressmx/database';
import { verifyEmailSchema } from '@expressmx/validations';
import { defineEndpoint } from '@/lib/api/handler';
import { BadRequestError, NotFoundError } from '@/lib/errors/http-errors';

interface VerificacionRow {
  id: string;
  usuario_id: string;
  expira_en: string;
  usado_en: string | null;
  intentos: number;
}

interface UsuarioRow {
  id: string;
  email: string;
  rol: 'cliente' | 'prestador' | 'admin';
  nombre: string;
  apellidos: string;
  avatar_url: string | null;
  email_verificado_en: string | null;
}

const MAX_INTENTOS = 5;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '7d';

export const POST = defineEndpoint({
  tag: 'POST /api/mobile/verify-email',
  auth: 'public',
  bodySchema: verifyEmailSchema,
  handler: async ({ body }) => {
    const result = await withTransaction(async (tx) => {
      const usuario = await tx.queryOne<UsuarioRow>(
        `SELECT id, email, rol, nombre, apellidos, avatar_url, email_verificado_en
         FROM usuarios WHERE email = $1`,
        [body.email]
      );
      if (!usuario) throw new NotFoundError('Cuenta no encontrada');
      if (usuario.email_verificado_en) {
        throw new BadRequestError('El correo ya está verificado');
      }

      const verif = await tx.queryOne<VerificacionRow>(
        `SELECT id, usuario_id, expira_en, usado_en, intentos
         FROM email_verificaciones
         WHERE usuario_id = $1 AND usado_en IS NULL
         ORDER BY created_at DESC LIMIT 1
         FOR UPDATE`,
        [usuario.id]
      );

      if (!verif) {
        throw new BadRequestError('No hay código pendiente. Solicita uno nuevo.');
      }
      if (verif.intentos >= MAX_INTENTOS) {
        throw new BadRequestError('Demasiados intentos. Solicita un código nuevo.');
      }
      if (new Date(verif.expira_en).getTime() < Date.now()) {
        throw new BadRequestError('Código expirado. Solicita uno nuevo.');
      }

      const match = await tx.queryOne<{ id: string }>(
        `SELECT id FROM email_verificaciones
         WHERE id = $1 AND codigo = $2`,
        [verif.id, body.codigo]
      );

      if (!match) {
        await tx.query(
          `UPDATE email_verificaciones SET intentos = intentos + 1 WHERE id = $1`,
          [verif.id]
        );
        throw new BadRequestError('Código incorrecto');
      }

      await tx.query(
        `UPDATE email_verificaciones SET usado_en = NOW() WHERE id = $1`,
        [verif.id]
      );
      await tx.query(
        `UPDATE usuarios SET email_verificado_en = NOW(), activo = true WHERE id = $1`,
        [usuario.id]
      );

      return usuario;
    });

    const token = jwt.sign(
      { sub: result.id, email: result.email, rol: result.rol },
      process.env.JWT_SECRET!,
      { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
    );

    const response = NextResponse.json({
      data: {
        token,
        usuario: {
          id: result.id,
          nombre: result.nombre,
          apellidos: result.apellidos,
          email: result.email,
          rol: result.rol,
          avatar_url: result.avatar_url,
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
