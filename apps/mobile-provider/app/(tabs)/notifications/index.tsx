import { useFocusEffect, useRouter } from 'expo-router';
import { Bell, Briefcase, Megaphone, ShieldCheck } from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { EmptyState } from '@/components/ui-app/empty-state';
import { ListRowSkeleton } from '@/components/ui-app/list-row-skeleton';
import { ScreenHeader } from '@/components/ui-app/screen-header';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { StatusCard } from '@/components/ui-app/status-card';
import { api } from '@/lib/api/client';
import { palette } from '@/lib/theme/tokens';

interface Notif {
  id: string;
  titulo: string;
  cuerpo: string | null;
  canal: 'orden' | 'promo' | 'sistema';
  deeplink: string | null;
  leida: boolean;
  created_at: string;
}

interface NotifsResponse {
  data: Notif[];
}

const ICON_BY_CANAL: Record<Notif['canal'], React.ReactNode> = {
  orden: <Briefcase size={20} color={palette.brandStrong} />,
  promo: <Megaphone size={20} color={palette.warning} />,
  sistema: <ShieldCheck size={20} color={palette.textSecondary} />,
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 7) return `hace ${d} d`;
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

export default function ProviderNotifications() {
  const router = useRouter();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await api.get<NotifsResponse>('/v1/mobile/notifications?limit=40');
      setItems(response.data ?? []);
    } catch {
      void 0;
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function markRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, leida: true } : n)));
    try {
      await api.patch(`/v1/mobile/notifications/${id}/read`, {});
    } catch {
      void 0;
    }
  }

  async function openNotification(notification: Notif) {
    if (!notification.leida) await markRead(notification.id);
    if (notification.deeplink) router.push(notification.deeplink as never);
  }

  return (
    <ScreenShell applyBottomInset={false}>
      <ScreenHeader title="Notificaciones" subtitle="Avisos de tus servicios y la empresa" />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 48 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={palette.brand} />
        }
      >
        {loading && items.length === 0 ? (
          <VStack className="gap-2">
            <ListRowSkeleton showLeading />
            <ListRowSkeleton showLeading />
            <ListRowSkeleton showLeading />
            <ListRowSkeleton showLeading />
            <ListRowSkeleton showLeading />
          </VStack>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Bell size={28} color={palette.brand} weight="duotone" />}
            title="Sin notificaciones"
            description="No tienes notificaciones por ahora. Cuando llegue algo, aparecerá aquí."
          />
        ) : (
          <VStack className="gap-2">
            {items.map((n) => (
              <StatusCard
                key={n.id}
                title={n.titulo}
                meta={`${relativeTime(n.created_at)}${n.cuerpo ? ` · ${n.cuerpo}` : ''}`}
                leadingIcon={
                  <Box className="w-10 h-10 rounded-lg bg-card items-center justify-center border border-border">
                    {ICON_BY_CANAL[n.canal]}
                  </Box>
                }
                tone={n.leida ? 'default' : 'highlighted'}
                badge={!n.leida ? <Box className="w-2 h-2 rounded-full bg-primary" /> : undefined}
                onPress={() => openNotification(n)}
              />
            ))}
          </VStack>
        )}
      </ScrollView>
    </ScreenShell>
  );
}
