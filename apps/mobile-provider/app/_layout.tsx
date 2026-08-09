import { useEffect, useRef, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '@/global.css';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import {
  IncomingOrderCard,
  type IncomingOrderPreview,
} from '@/components/ui-app/incoming-order-card';
import {
  configureNotificationHandler,
  ensureNotificationsSetup,
  setupNotificationListeners,
} from '@/lib/notifications';
import { api } from '@/lib/api/client';
import { getStoredUser } from '@/lib/auth/session';
import { addRealtimeListener, connectProviderRealtime, type RealtimeEvent } from '@/lib/realtime';
import {
  configureAudioModeForUiSounds,
  startProviderOrderLoop,
  stopProviderOrderLoop,
} from '@/lib/sfx';

configureNotificationHandler();

export default function RootLayout() {
  const router = useRouter();
  const [incomingOrder, setIncomingOrder] = useState<IncomingOrderPreview | null>(null);
  const handledIncomingOrderIdRef = useRef<string | null>(null);

  useEffect(() => {
    configureAudioModeForUiSounds().catch(() => null);
    ensureNotificationsSetup().catch(() => null);
    getStoredUser().then(connectProviderRealtime).catch(() => null);
    const realtimeCleanup = addRealtimeListener((event) => {
      if (event.name === 'order.assigned') {
        startProviderOrderLoop().catch(() => null);
        showIncomingOrder(event).catch(() => null);
      }
    });
    const cleanup = setupNotificationListeners(router);
    return () => {
      realtimeCleanup();
      stopProviderOrderLoop();
      cleanup();
    };
  }, [router]);

  async function showIncomingOrder(event: RealtimeEvent) {
    const orderId = event.data.orderId;
    if (!orderId) return;
    handledIncomingOrderIdRef.current = null;

    setIncomingOrder({
      id: orderId,
      serviceName: event.data.serviceName ?? event.data.title ?? 'Servicio asignado',
      scheduledAt: event.data.scheduledAt ?? null,
      address: event.data.address ?? null,
      zone: event.data.zone ?? null,
      latitude: event.data.latitude ?? null,
      longitude: event.data.longitude ?? null,
      total: null,
    });

    const response = await api.get<{
      orden: {
        id: string;
        servicio_nombre: string;
        fecha_programada: string | null;
        direccion: string | null;
        cliente_zona: string | null;
        direccion_latitud: number | null;
        direccion_longitud: number | null;
        total: number;
      };
    }>(`/v1/mobile/provider/jobs/${orderId}`);

    if (handledIncomingOrderIdRef.current === orderId) return;

    setIncomingOrder({
      id: response.orden.id,
      serviceName: response.orden.servicio_nombre,
      scheduledAt: response.orden.fecha_programada,
      address: response.orden.direccion,
      zone: response.orden.cliente_zona,
      latitude: response.orden.direccion_latitud,
      longitude: response.orden.direccion_longitud,
      total: response.orden.total,
    });
  }

  function viewIncomingOrder() {
    if (!incomingOrder) return;
    const id = incomingOrder.id;
    handledIncomingOrderIdRef.current = id;
    stopProviderOrderLoop();
    setIncomingOrder(null);
    router.push({ pathname: '/jobs/[id]', params: { id } });
  }

  function handleIncomingRoute() {
    if (!incomingOrder) return;
    handledIncomingOrderIdRef.current = incomingOrder.id;
    stopProviderOrderLoop();
  }

  return (
    <SafeAreaProvider>
      <GluestackUIProvider mode="light">
        <StatusBar style="dark" translucent backgroundColor="transparent" />
        <Stack screenOptions={{ headerShown: false }} />
        <IncomingOrderCard
          order={incomingOrder}
          onView={viewIncomingOrder}
          onRoute={handleIncomingRoute}
        />
      </GluestackUIProvider>
    </SafeAreaProvider>
  );
}
