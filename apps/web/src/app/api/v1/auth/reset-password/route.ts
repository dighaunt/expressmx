import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { queryOne, query } from '@expressmx/database';
import { resetPasswordSchema } from '@expressmx/validations';
import { defineEndpoint } from '@/lib/api/handler';
import { BadRequestError } from '@/lib/errors/http-errors';

export const POST = defineEndpoint({
  tag: 'POST /api/v1/auth/reset-password',
  auth: 'public',
  bodySchema: resetPasswordSchema,
  handler: async ({ body }) => {
    const resetToken = await queryOne<{
      id: string;
      user_id: string;
      expires_at: string;
      used: boolean;
    }>(
      `SELECT id, user_id, expires_at, used FROM password_reset_tokens WHERE token = $1`,
      [body.token]
    );

    if (!resetToken || resetToken.used || new Date(resetToken.expires_at) < new Date()) {
      throw new BadRequestError('El enlace es inválido o ha expirado');
    }

    const passwordHash = await bcrypt.hash(body.password, 12);

    await query(
      `INSERT INTO user_credentials (user_id, password_hash, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = NOW()`,
      [resetToken.user_id, passwordHash]
    );

    await query(
      `UPDATE password_reset_tokens SET used = true WHERE id = $1`,
      [resetToken.id]
    );

    return NextResponse.json({ data: { message: 'Contraseña actualizada correctamente' } });
  },
});
