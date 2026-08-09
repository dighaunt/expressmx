'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getWebRealtimeClient } from '@/lib/realtime/client';

interface Props {
  ticketId: string;
}

export function TicketRealtimeRefresh({ ticketId }: Props) {
  const router = useRouter();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const client = getWebRealtimeClient();
    const channel = client.channels.get(`ticket:${ticketId}`);
    const refresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), 150);
    };

    channel.subscribe('ticket.message_created', refresh).catch(() => undefined);
    channel.subscribe('ticket.updated', refresh).catch(() => undefined);

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      channel.unsubscribe('ticket.message_created', refresh);
      channel.unsubscribe('ticket.updated', refresh);
    };
  }, [router, ticketId]);

  return null;
}
