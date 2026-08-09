import { query } from '@expressmx/database';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
export const PROVIDER_ORDER_CHANNEL_ID = 'provider-orders';
export const PROVIDER_NOTIFICATION_SOUND = 'notification.wav';

interface PushTokenRow {
  token: string;
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: {
    error?: string;
  };
}

interface ExpoPushResponse {
  data?: ExpoPushTicket | ExpoPushTicket[];
}

interface PushNotificationInput {
  userId: string;
  title: string;
  body: string;
  deeplink: string;
  app: 'client' | 'provider';
  channelId?: string;
  sound?: string;
}

export async function sendPushNotificationToUser(input: PushNotificationInput): Promise<void> {
  const rows = await query<PushTokenRow>(
    `SELECT token
     FROM push_tokens
     WHERE usuario_id = $1
       AND app = $2
       AND activo = true`,
    [input.userId, input.app],
  );

  if (rows.length === 0) return;

  const messages = rows.map((row) => ({
    to: row.token,
    title: input.title,
    body: input.body,
    data: { deeplink: input.deeplink },
    sound: input.sound ?? 'default',
    channelId: input.channelId,
  }));

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const payload = (await res.json().catch(() => null)) as ExpoPushResponse | null;
    const tickets = Array.isArray(payload?.data)
      ? payload.data
      : payload?.data
        ? [payload.data]
        : [];
    const expiredTokens = tickets
      .map((ticket, index) =>
        ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered'
          ? rows[index]?.token
          : null,
      )
      .filter((token): token is string => Boolean(token));

    if (expiredTokens.length > 0) {
      await query('UPDATE push_tokens SET activo = false, updated_at = NOW() WHERE token = ANY($1)', [
        expiredTokens,
      ]);
    }
  } catch (err) {
    console.error('[push] failed to send notification', err);
  }
}
