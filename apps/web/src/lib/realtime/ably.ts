import { SignJWT } from 'jose';
import { query } from '@expressmx/database';

type RealtimeEventName =
  | 'order.assigned'
  | 'order.status_changed'
  | 'order.provider_location'
  | 'ticket.message_created'
  | 'ticket.updated'
  | 'dashboard.changed'
  | 'notification.created';

interface RealtimePayload {
  orderId?: string;
  status?: string;
  serviceName?: string;
  title?: string;
  body?: string;
  deeplink?: string;
  scheduledAt?: string;
  address?: string | null;
  zone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  providerLatitude?: number | null;
  providerLongitude?: number | null;
  providerAccuracy?: number | null;
  providerHeading?: number | null;
  providerSpeed?: number | null;
  providerLocationUpdatedAt?: string | null;
  ticketId?: string;
  messageId?: string;
  content?: string;
  authorId?: string | null;
  authorName?: string | null;
  authorType?: 'usuario' | 'agente' | 'sistema';
  internal?: boolean;
  createdAt?: string;
  scope?: string;
}

interface RealtimePublishInput {
  channel: string;
  name: RealtimeEventName;
  data: RealtimePayload;
}

interface RealtimeTokenInput {
  userId: string;
  role: string;
}

interface RealtimeOrderAccessRow {
  id: string;
  estatus: string;
}

interface RealtimeTicketAccessRow {
  id: string;
  estatus: string;
}

function getAblyKeyParts(): { keyName: string; keySecret: string } | null {
  const key = process.env.ABLY_API_KEY;
  if (!key) return null;
  const [keyName, keySecret] = key.split(':');
  if (!keyName || !keySecret) return null;
  return { keyName, keySecret };
}

export async function createRealtimeJwt(input: RealtimeTokenInput): Promise<string | null> {
  const parts = getAblyKeyParts();
  if (!parts) return null;

  const now = Math.floor(Date.now() / 1000);
  const capability: Record<string, string[]> = {};
  if (input.role === 'prestador') {
    capability[`provider:${input.userId}`] = ['subscribe'];
    capability['dashboard:operaciones'] = ['subscribe'];
    const orders = await query<RealtimeOrderAccessRow>(
      `SELECT id, estatus
       FROM ordenes_servicio
       WHERE prestador_id = $1
         AND estatus IN ('en_camino', 'en_progreso')`,
      [input.userId],
    );
    for (const order of orders) {
      capability[`order:${order.id}`] = ['publish'];
    }
  } else if (input.role === 'cliente') {
    capability[`client:${input.userId}`] = ['subscribe'];
    const orders = await query<RealtimeOrderAccessRow>(
      `SELECT id, estatus
       FROM ordenes_servicio
       WHERE cliente_id = $1
         AND estatus IN ('asignada', 'en_camino', 'en_progreso')`,
      [input.userId],
    );
    for (const order of orders) {
      capability[`order:${order.id}`] = ['subscribe'];
    }
    const tickets = await query<RealtimeTicketAccessRow>(
      `SELECT id, estatus
       FROM tickets_soporte
       WHERE usuario_id = $1
         AND estatus IN ('abierto', 'en_revision', 'escalado')`,
      [input.userId],
    );
    for (const ticket of tickets) {
      capability[`ticket:${ticket.id}`] = ['subscribe'];
    }
  } else if (input.role === 'admin') {
    capability['dashboard:*'] = ['subscribe'];
    capability['ticket:*'] = ['subscribe'];
  }

  if (Object.keys(capability).length === 0) return null;

  return await new SignJWT({
    'x-ably-capability': JSON.stringify(capability),
    'x-ably-clientId': `${input.role}:${input.userId}`,
  })
    .setProtectedHeader({ alg: 'HS256', kid: parts.keyName })
    .setIssuedAt(now)
    .setExpirationTime(now + 60 * 60)
    .sign(new TextEncoder().encode(parts.keySecret));
}

export async function publishRealtimeEvent(input: RealtimePublishInput): Promise<void> {
  const key = process.env.ABLY_API_KEY;
  if (!key) return;

  try {
    await fetch(`https://rest.ably.io/channels/${encodeURIComponent(input.channel)}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(key).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: input.name,
        data: input.data,
      }),
    });
  } catch (err) {
    console.error('[realtime] failed to publish event', err);
  }
}

export async function publishOrderRealtimeEvent(input: {
  clientId?: string | null;
  providerId?: string | null;
  name: RealtimeEventName;
  data: RealtimePayload;
}): Promise<void> {
  const orderId = input.data.orderId;
  const dashboardData: RealtimePayload = { scope: 'operaciones' };
  if (orderId) dashboardData.orderId = orderId;
  if (input.data.status) dashboardData.status = input.data.status;
  const dashboardEvent =
    input.name === 'order.provider_location'
      ? Promise.resolve()
      : publishDashboardRealtimeEvent('operaciones', dashboardData);
  await Promise.all([
    dashboardEvent,
    orderId
      ? publishRealtimeEvent({
          channel: `order:${orderId}`,
          name: input.name,
          data: input.data,
        })
      : Promise.resolve(),
    input.clientId
      ? publishRealtimeEvent({
          channel: `client:${input.clientId}`,
          name: input.name,
          data: input.data,
        })
      : Promise.resolve(),
    input.providerId
      ? publishRealtimeEvent({
          channel: `provider:${input.providerId}`,
          name: input.name,
          data: input.data,
        })
      : Promise.resolve(),
  ]);
}

export async function publishDashboardRealtimeEvent(
  scope: string,
  data: RealtimePayload = {},
): Promise<void> {
  await publishRealtimeEvent({
    channel: `dashboard:${scope}`,
    name: 'dashboard.changed',
    data: { ...data, scope },
  });
}

export async function publishTicketRealtimeEvent(input: {
  ticketId: string;
  name: 'ticket.message_created' | 'ticket.updated';
  data: RealtimePayload;
}): Promise<void> {
  await Promise.all([
    publishRealtimeEvent({
      channel: `ticket:${input.ticketId}`,
      name: input.name,
      data: { ...input.data, ticketId: input.ticketId },
    }),
    publishDashboardRealtimeEvent('soporte', {
      scope: 'soporte',
      ticketId: input.ticketId,
    }),
  ]);
}
