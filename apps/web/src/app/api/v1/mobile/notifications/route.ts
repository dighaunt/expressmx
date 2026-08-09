import { NextResponse } from 'next/server';
import { query } from '@expressmx/database';
import { mobileNotificationsQuerySchema } from '@expressmx/validations';
import { defineEndpoint } from '@/lib/api/handler';
import { buildPage, decodeCursor } from '@/lib/api/cursor';

interface NotificationRow {
  id: string;
  tipo: string;
  titulo: string;
  cuerpo: string | null;
  canal: string;
  deeplink: string | null;
  leida: boolean;
  created_at: string;
}

export const GET = defineEndpoint({
  tag: 'GET /api/v1/mobile/notifications',
  auth: 'session',
  querySchema: mobileNotificationsQuerySchema,
  handler: async ({ query: q, session }) => {
    const limit = q.limit ?? 20;
    const cursor = q.cursor ? decodeCursor(q.cursor) : null;
    const onlyUnread = q.no_leidas === true;

    const rows = await query<NotificationRow>(
      `SELECT id, tipo, titulo, cuerpo, canal, deeplink, leida, created_at
       FROM notificaciones
       WHERE usuario_id = $1
         AND ($2::boolean IS NOT TRUE OR leida = false)
         AND ($3::timestamptz IS NULL OR (created_at, id) < ($3::timestamptz, $4::uuid))
       ORDER BY created_at DESC, id DESC
       LIMIT $5`,
      [session!.sub, onlyUnread, cursor?.at ?? null, cursor?.id ?? null, limit + 1]
    );

    const page = buildPage(rows, limit, (row) => ({ at: row.created_at, id: row.id }));
    return NextResponse.json(page);
  },
});
