import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { queryOne, query } from '@expressmx/database';
import { forgotPasswordSchema } from '@expressmx/validations';
import { sendPasswordResetEmail } from '@/lib/email';
import { defineEndpoint } from '@/lib/api/handler';

const okResponse = () =>
  NextResponse.json(
    { message: 'Si el correo está registrado, recibirás un enlace de recuperación.' },
    { status: 200 }
  );

export const POST = defineEndpoint({
  tag: 'POST /api/auth/forgot-password',
  auth: 'public',
  bodySchema: forgotPasswordSchema,
  handler: async ({ body }) => {
    const usuario = await queryOne<{ id: string; email: string }>(
      `SELECT id, email FROM usuarios WHERE email = $1 AND rol = 'admin' AND activo = true`,
      [body.email]
    );

    if (!usuario) return okResponse();

    await query(
      `UPDATE password_reset_tokens SET used = true WHERE user_id = $1 AND used = false`,
      [usuario.id]
    );

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [usuario.id, token, expiresAt]
    );

    await sendPasswordResetEmail(usuario.email, token);

    return okResponse();
  },
});
