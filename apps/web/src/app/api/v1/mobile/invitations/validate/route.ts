import { NextResponse } from 'next/server';
import { queryOne } from '@expressmx/database';
import { mobileInvitationValidateSchema } from '@expressmx/validations';
import { defineEndpoint } from '@/lib/api/handler';
import { BadRequestError } from '@/lib/errors/http-errors';

interface InvitacionRow {
  id: string;
  expira_en: string;
  usado_en: string | null;
  revocada_en: string | null;
  notas: string | null;
}

export const POST = defineEndpoint({
  tag: 'POST /api/v1/mobile/invitations/validate',
  auth: 'public',
  bodySchema: mobileInvitationValidateSchema,
  handler: async ({ body }) => {
    const invitacion = await queryOne<InvitacionRow>(
      `SELECT id, expira_en, usado_en, revocada_en, notas
       FROM invitaciones_prestadores
       WHERE codigo = $1`,
      [body.codigo]
    );

    if (!invitacion) throw new BadRequestError('Código no encontrado');
    if (invitacion.revocada_en) throw new BadRequestError('Código revocado');
    if (invitacion.usado_en) throw new BadRequestError('Código ya utilizado');
    if (new Date(invitacion.expira_en).getTime() < Date.now()) {
      throw new BadRequestError('Código expirado');
    }

    return NextResponse.json({
      data: {
        valido: true,
        expira_en: invitacion.expira_en,
        notas: invitacion.notas,
      },
    });
  },
});
