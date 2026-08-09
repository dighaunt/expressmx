import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { queryOne, withTransaction } from '@expressmx/database';
import { mobileRegisterSchema } from '@expressmx/validations';
import { defineEndpoint } from '@/lib/api/handler';
import { ConflictError, BadRequestError } from '@/lib/errors/http-errors';
import { sendVerificationCodeEmail, generateVerificationCode } from '@/lib/email';

interface InvitacionRow {
  id: string;
  expira_en: string;
  usado_en: string | null;
  revocada_en: string | null;
}

const VERIFICATION_TTL_MIN = 15;

export const POST = defineEndpoint({
  tag: 'POST /api/mobile/register',
  auth: 'public',
  bodySchema: mobileRegisterSchema,
  handler: async ({ body }) => {
    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM usuarios WHERE email = $1',
      [body.email]
    );
    if (existing) throw new ConflictError('Ya existe una cuenta con ese correo');

    const hash = await bcrypt.hash(body.password, 12);
    const codigoInv = body.codigo_invitacion?.trim().toUpperCase();
    const codigoVerif = generateVerificationCode();

    const created = await withTransaction(async (tx) => {
      if (body.rol === 'prestador') {
        if (!codigoInv) {
          throw new BadRequestError(
            'Se requiere código de invitación para registrarse como prestador'
          );
        }

        const invitacion = await tx.queryOne<InvitacionRow>(
          `SELECT id, expira_en, usado_en, revocada_en
           FROM invitaciones_prestadores
           WHERE codigo = $1
           FOR UPDATE`,
          [codigoInv]
        );

        if (!invitacion) throw new BadRequestError('Código de invitación no existe');
        if (invitacion.revocada_en) throw new BadRequestError('Código de invitación revocado');
        if (invitacion.usado_en) throw new BadRequestError('Código de invitación ya utilizado');
        if (new Date(invitacion.expira_en).getTime() < Date.now()) {
          throw new BadRequestError('Código de invitación expirado');
        }
      }

      const inserted = await tx.queryOne<{ id: string }>(
        `WITH nuevo AS (
          INSERT INTO usuarios (nombre, apellidos, email, telefono, rol, activo, email_verificado_en)
          VALUES ($1, $2, $3, $4, $5, false, NULL)
          RETURNING id
        )
        INSERT INTO user_credentials (user_id, password_hash)
        SELECT id, $6 FROM nuevo
        RETURNING user_id AS id`,
        [body.nombre, body.apellidos, body.email, body.telefono ?? null, body.rol, hash]
      );

      if (!inserted) throw new Error('No se pudo crear el usuario');

      await tx.query(
        `INSERT INTO email_verificaciones (usuario_id, codigo, expira_en, enviado_a)
         VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval, $4)`,
        [inserted.id, codigoVerif, String(VERIFICATION_TTL_MIN), body.email]
      );

      if (body.rol === 'prestador' && codigoInv) {
        await tx.query(
          `UPDATE invitaciones_prestadores
           SET usado_en = NOW()
           WHERE codigo = $1`,
          [codigoInv]
        );
      }

      return inserted;
    });

    let emailEnviado = true;
    let emailError: string | null = null;
    try {
      await sendVerificationCodeEmail(body.email, codigoVerif);
    } catch (err) {
      emailEnviado = false;
      emailError =
        err instanceof Error ? err.message : 'No pudimos enviar el correo de verificación.';
      console.error('[register] failed to send verification email', err);
    }

    return NextResponse.json(
      {
        data: {
          id: created.id,
          email: body.email,
          pendiente_verificacion: true,
          email_enviado: emailEnviado,
          email_error: emailError,
          expira_en_minutos: VERIFICATION_TTL_MIN,
        },
      },
      { status: 201 }
    );
  },
});
