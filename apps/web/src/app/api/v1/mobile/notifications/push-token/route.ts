import { NextResponse } from 'next/server';
import { queryOne } from '@expressmx/database';
import { mobilePushTokenSchema } from '@expressmx/validations';
import { defineEndpoint } from '@/lib/api/handler';

export const POST = defineEndpoint({
  tag: 'POST /api/v1/mobile/notifications/push-token',
  auth: 'session',
  bodySchema: mobilePushTokenSchema,
  handler: async ({ body, session }) => {
    const row = await queryOne<{ id: string }>(
      `INSERT INTO push_tokens (usuario_id, token, plataforma, app, activo, updated_at)
       VALUES ($1, $2, $3, $4, true, NOW())
       ON CONFLICT (token)
       DO UPDATE SET
         usuario_id = EXCLUDED.usuario_id,
         plataforma = EXCLUDED.plataforma,
         app = EXCLUDED.app,
         activo = true,
         updated_at = NOW()
       RETURNING id`,
      [session!.sub, body.token, body.plataforma, body.app],
    );

    return NextResponse.json({ data: row });
  },
});
