import * as Ably from 'ably';
import { apiBaseUrl } from '@/lib/api/client';
import { getCachedUser, getToken, type SessionUser } from '@/lib/auth/session';

export type RealtimeEventName =
  | 'order.assigned'
  | 'order.status_changed'
  | 'order.provider_location'
  | 'ticket.message_created'
  | 'ticket.updated'
  | 'notification.created';

export interface RealtimeEvent {
  name: RealtimeEventName;
  data: {
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
  };
}

type RealtimeListener = (event: RealtimeEvent) => void;

const listeners = new Set<RealtimeListener>();
let realtime: Ably.Realtime | null = null;
let connectedUserId: string | null = null;

export function addRealtimeListener(listener: RealtimeListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function toRealtimeEvent(message: Ably.Message): RealtimeEvent {
  return {
    name: message.name as RealtimeEventName,
    data: (message.data ?? {}) as RealtimeEvent['data'],
  };
}

async function ensureRealtime() {
  if (realtime) return realtime;
  const user = await getCachedUser();
  await connectClientRealtime(user);
  if (!realtime) throw new Error('Realtime no está conectado.');
  return realtime;
}

export async function connectClientRealtime(user: SessionUser | null): Promise<void> {
  if (!user?.id) return;
  if (connectedUserId === user.id && realtime) return;
  disconnectClientRealtime();

  realtime = new Ably.Realtime({
    authCallback: async (_tokenParams, callback) => {
      try {
        const token = await getToken();
        if (!token) throw new Error('No session token');
        const response = await fetch(`${apiBaseUrl}/v1/mobile/realtime/token`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Realtime auth failed');
        callback(null, await response.text());
      } catch (err) {
        callback(err instanceof Error ? err.message : 'Realtime auth failed', null);
      }
    },
  });
  connectedUserId = user.id;

  const channel = realtime.channels.get(`client:${user.id}`);
  await channel.subscribe((message) => {
    const event = toRealtimeEvent(message);
    listeners.forEach((listener) => listener(event));
  });
}

export async function subscribeOrderRealtime(
  orderId: string,
  listener: RealtimeListener,
): Promise<() => void> {
  const client = await ensureRealtime();
  await client.auth.authorize();
  const channel = client.channels.get(`order:${orderId}`);
  const handler = (message: Ably.Message) => listener(toRealtimeEvent(message));
  await channel.subscribe(handler);
  return () => {
    channel.unsubscribe(handler);
  };
}

export async function subscribeTicketRealtime(
  ticketId: string,
  listener: RealtimeListener,
): Promise<() => void> {
  const client = await ensureRealtime();
  await client.auth.authorize();
  const channel = client.channels.get(`ticket:${ticketId}`);
  const handler = (message: Ably.Message) => listener(toRealtimeEvent(message));
  await channel.subscribe(handler);
  return () => {
    channel.unsubscribe(handler);
  };
}

export function disconnectClientRealtime() {
  connectedUserId = null;
  if (!realtime) return;
  realtime.close();
  realtime = null;
}
