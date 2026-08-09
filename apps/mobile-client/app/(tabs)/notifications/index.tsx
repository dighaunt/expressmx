import { useFocusEffect } from 'expo-router';
import { Bell, Megaphone, Receipt, WarningCircle } from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { EmptyState } from '@/components/ui-app/empty-state';
import { ListRowSkeleton } from '@/components/ui-app/list-row-skeleton';
import { ScreenHeader } from '@/components/ui-app/screen-header';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { StatusCard } from '@/components/ui-app/status-card';
import { api } from '@/lib/api/client';
import { relativeFromNow } from '@/lib/format';
import { palette } from '@/lib/theme/tokens';

interface Notif {
  id: string;
  tipo: 'push' | 'sms' | 'email';
  titulo: string;
  cuerpo: string | null;
  canal: 'orden' | 'promo' | 'sistema';
  deeplink: string | null;
  leida: boolean;
  created_at: string;
}

interface NotificationsResponse {
  data: Notif[];
  pagination: { cursor: string | null; limit: number; hasMore: boolean };
}

const channelDecor = {
  orden: { icon: Receipt, fg: palette.brand, bg: 'bg-primary-soft' },
  promo: { icon: Megaphone, fg: palette.warning, bg: 'bg-warning-soft' },
  sistema: { icon: WarningCircle, fg: palette.textSecondary, bg: 'bg-muted' },
} as const;

export default function NotificationsScreen() {
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await api.get<NotificationsResponse>('/v1/mobile/notifications?limit=30');
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

  const unreadCount = items.filter((n) => !n.leida).length;

  return (
    <ScreenShell>
      <ScreenHeader
        title="Notificaciones"
        subtitle={unreadCount > 0 ? `${unreadCount} sin leer` : 'Todo al día'}
      />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={palette.brand} />
        }
      >
        {loading && items.length === 0 ? (
          <VStack className="gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <ListRowSkeleton key={`notif-skeleton-${i}`} showLeading />
            ))}
          </VStack>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Bell size={28} color={palette.textTertiary} weight="duotone" />}
            title="Todo al día"
            description="Aún no tienes notificaciones. Te avisaremos cuando haya novedades."
          />
        ) : (
          <VStack className="gap-2">
            {items.map((n) => {
              const decor = channelDecor[n.canal] ?? channelDecor.sistema;
              const Icon = decor.icon;
              return (
                <StatusCard
                  key={n.id}
                  title={n.titulo}
                  tone={n.leida ? 'default' : 'highlighted'}
                  onPress={() => (!n.leida ? markRead(n.id) : undefined)}
                  leadingIcon={
                    <Box className={`w-10 h-10 rounded-lg items-center justify-center ${decor.bg}`}>
                      <Icon size={20} color={decor.fg} weight="duotone" />
                    </Box>
                  }
                  badge={!n.leida ? <Box className="w-2 h-2 rounded-sm bg-primary" /> : null}
                >
                  {n.cuerpo ? (
                    <Text className="text-sm text-foreground-secondary" numberOfLines={3}>
                      {n.cuerpo}
                    </Text>
                  ) : null}
                  <Text className="text-xs text-foreground-secondary">
                    {relativeFromNow(n.created_at)}
                  </Text>
                </StatusCard>
              );
            })}
          </VStack>
        )}
      </ScrollView>
    </ScreenShell>
  );
}
