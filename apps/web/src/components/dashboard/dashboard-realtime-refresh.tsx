'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getWebRealtimeClient } from '@/lib/realtime/client';

const DASHBOARD_CHANNELS = ['dashboard:operaciones', 'dashboard:soporte'];

export function DashboardRealtimeRefresh() {
  const router = useRouter();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const client = getWebRealtimeClient();
    const channels = DASHBOARD_CHANNELS.map((name) => client.channels.get(name));
    const refresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), 250);
    };

    channels.forEach((channel) => {
      channel.subscribe('dashboard.changed', refresh).catch(() => undefined);
    });

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      channels.forEach((channel) => channel.unsubscribe('dashboard.changed', refresh));
    };
  }, [router]);

  return null;
}
