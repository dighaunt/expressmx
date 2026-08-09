import * as Ably from 'ably';
import { apiBaseUrl } from '@/lib/api/client';
import { getStoredUser, getToken, type AuthUser } from '@/lib/auth/session';

export type RealtimeEventName =
  | 'order.assigned'
  | 'order.status_changed'
  | 'order.provider_location'
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
  const user = await getStoredUser();
  await connectProviderRealtime(user);
  if (!realtime) throw new Error('Realtime no está conectado.');
  return realtime;
}

export async function connectProviderRealtime(user: AuthUser | null): Promise<void> {
  if (!user?.id) return;
  if (connectedUserId === user.id && realtime) return;
  disconnectProviderRealtime();

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

  const channel = realtime.channels.get(`provider:${user.id}`);
  await channel.subscribe((message) => {
    const event = toRealtimeEvent(message);
    listeners.forEach((listener) => listener(event));
  });
}

export async function publishOrderLocation(orderId: string, data: RealtimeEvent['data']) {
  const client = await ensureRealtime();
  await client.auth.authorize();
  await client.channels.get(`order:${orderId}`).publish('order.provider_location', data);
}

export function disconnectProviderRealtime() {
  connectedUserId = null;
  if (!realtime) return;
  realtime.close();
  realtime = null;
}
