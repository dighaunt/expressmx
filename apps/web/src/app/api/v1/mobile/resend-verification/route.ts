import { NextResponse } from 'next/server';
import { query, withTransaction } from '@expressmx/database';
import { resendVerificationSchema } from '@expressmx/validations';
import { defineEndpoint } from '@/lib/api/handler';
import {
  BadGatewayError,
  BadRequestError,
  NotFoundError,
  TooManyRequestsError,
} from '@/lib/errors/http-errors';
import { sendVerificationCodeEmail, generateVerificationCode } from '@/lib/email';

const VERIFICATION_TTL_MIN = 15;
const MIN_SECONDS_BETWEEN_RESEND = 60;

export const POST = defineEndpoint({
  tag: 'POST /api/mobile/resend-verification',
  auth: 'public',
  bodySchema: resendVerificationSchema,
  handler: async ({ body }) => {
    const codigo = generateVerificationCode();

    const inserted = await withTransaction(async (tx) => {
      const usuario = await tx.queryOne<{ id: string; email_verificado_en: string | null }>(
        `SELECT id, email_verificado_en FROM usuarios WHERE email = $1`,
        [body.email]
      );
      if (!usuario) throw new NotFoundError('Cuenta no encontrada');
      if (usuario.email_verificado_en) {
        throw new BadRequestError('El correo ya está verificado');
      }

      const ultimo = await tx.queryOne<{ created_at: string }>(
        `SELECT created_at FROM email_verificaciones
         WHERE usuario_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [usuario.id]
      );

      if (ultimo) {
        const elapsed = (Date.now() - new Date(ultimo.created_at).getTime()) / 1000;
        if (elapsed < MIN_SECONDS_BETWEEN_RESEND) {
          throw new TooManyRequestsError(
            `Espera ${Math.ceil(MIN_SECONDS_BETWEEN_RESEND - elapsed)}s antes de solicitar otro código`
          );
        }
      }

      await tx.query(
        `UPDATE email_verificaciones SET usado_en = NOW()
         WHERE usuario_id = $1 AND usado_en IS NULL`,
        [usuario.id]
      );

      const row = await tx.queryOne<{ id: string }>(
        `INSERT INTO email_verificaciones (usuario_id, codigo, expira_en, enviado_a)
         VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval, $4)
         RETURNING id`,
        [usuario.id, codigo, String(VERIFICATION_TTL_MIN), body.email]
      );

      if (!row) throw new Error('No se pudo registrar el código');
      return row;
    });

    try {
      await sendVerificationCodeEmail(body.email, codigo);
    } catch (err) {
      await query(`DELETE FROM email_verificaciones WHERE id = $1`, [inserted.id]);
      console.error('[resend-verification] failed to send email', err);
      throw new BadGatewayError(
        'No pudimos enviar el correo de verificación. Inténtalo de nuevo en un momento.'
      );
    }

    return NextResponse.json({
      data: {
        email: body.email,
        pendiente_verificacion: true,
        expira_en_minutos: VERIFICATION_TTL_MIN,
      },
    });
  },
});
