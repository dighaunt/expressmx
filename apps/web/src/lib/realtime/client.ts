'use client';

import * as Ably from 'ably';

let realtime: Ably.Realtime | null = null;

export function getWebRealtimeClient() {
  if (realtime) return realtime;
  realtime = new Ably.Realtime({
    authCallback: async (_tokenParams, callback) => {
      try {
        const response = await fetch('/api/realtime/token', { credentials: 'include' });
        if (!response.ok) throw new Error('Realtime auth failed');
        callback(null, await response.text());
      } catch (err) {
        callback(err instanceof Error ? err.message : 'Realtime auth failed', null);
      }
    },
  });
  return realtime;
}
