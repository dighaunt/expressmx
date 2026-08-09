import { useFocusEffect, useRouter } from 'expo-router';
import { Receipt } from 'phosphor-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { EmptyState } from '@/components/ui-app/empty-state';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { Skeleton } from '@/components/ui-app/skeleton';
import { api } from '@/lib/api/client';
import { formatDateLong, formatPrice } from '@/lib/format';
import { addRealtimeListener } from '@/lib/realtime';
import {
  bucketByAge,
  estatusOrden,
  palette,
  type EstatusOrden,
  toneMap,
  type Tone,
  type WalletState,
} from '@/lib/theme/tokens';

interface OrderListItem {
  id: string;
  estatus: EstatusOrden;
  created_at: string;
  fecha_creacion: string;
  servicio_nombre: string;
  prestador_nombre: string | null;
  total: number;
}

interface OrdersListResponse {
  data: OrderListItem[];
  pagination: { cursor: string | null; limit: number; hasMore: boolean };
}

const ACTIVE_ORDER_STATES: EstatusOrden[] = [
  'solicitada',
  'asignada',
  'en_camino',
  'en_progreso',
];

type OrderListRow =
  | { type: 'section'; key: string; label: string; count: number; muted?: boolean }
  | { type: 'order'; key: string; order: OrderListItem; state: WalletState }
  | { type: 'archive-toggle'; key: string; count: number };

export default function OrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [archivedExpanded, setArchivedExpanded] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await api.get<OrdersListResponse>('/v1/mobile/orders?limit=50');
      setOrders(response.data ?? []);
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

  useEffect(() => {
    return addRealtimeListener((event) => {
      if (event.name === 'order.assigned' || event.name === 'order.status_changed') {
        void load();
      }
    });
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const rows = useMemo<OrderListRow[]>(() => {
    const active: OrderListRow[] = [];
    const recent: OrderListRow[] = [];
    const archived: OrderListRow[] = [];

    for (const order of orders) {
      const isActive = ACTIVE_ORDER_STATES.includes(order.estatus);
      const state = bucketByAge(isActive, order.fecha_creacion ?? order.created_at);
      const row: OrderListRow = {
        type: 'order',
        key: order.id,
        order,
        state,
      };
      if (state === 'active') active.push(row);
      else if (state === 'recent') recent.push(row);
      else archived.push(row);
    }

    const nextRows: OrderListRow[] = [];
    if (active.length > 0) {
      nextRows.push({ type: 'section', key: 'section-active', label: 'Activos', count: active.length });
      nextRows.push(...active);
    }
    if (recent.length > 0) {
      nextRows.push({ type: 'section', key: 'section-recent', label: 'Recientes', count: recent.length });
      nextRows.push(...recent);
    }
    if (archived.length > 0) {
      nextRows.push({
        type: 'section',
        key: 'section-archived',
        label: 'Histórico',
        count: archived.length,
        muted: true,
      });
      if (archivedExpanded) nextRows.push(...archived);
      else nextRows.push({ type: 'archive-toggle', key: 'archive-toggle', count: archived.length });
    }

    return nextRows;
  }, [archivedExpanded, orders]);

  const renderItem = useCallback(
    ({ item }: { item: OrderListRow }) => {
      if (item.type === 'section') {
        return <SectionHeader label={item.label} count={item.count} muted={item.muted} />;
      }
      if (item.type === 'archive-toggle') {
        return (
          <Pressable onPress={() => setArchivedExpanded(true)} accessibilityRole="button">
            <Box className="py-3">
              <Text className="text-sm font-semibold text-foreground-secondary">
                {item.count === 1 ? 'Ver 1 pedido anterior' : `Ver ${item.count} pedidos anteriores`}
              </Text>
            </Box>
          </Pressable>
        );
      }
      return (
        <OrderRow
          order={item.order}
          state={item.state}
          onPress={() =>
            router.push({ pathname: '/order-tracking', params: { id: item.order.id } })
          }
        />
      );
    },
    [router],
  );

  return (
    <ScreenShell applyBottomInset={false}>
      <Box className="flex-1">
        <FlatList
          data={loading && orders.length === 0 ? [] : rows}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          contentInsetAdjustmentBehavior="automatic"
          refreshing={refreshing}
          onRefresh={handleRefresh}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48, flexGrow: 1 }}
          ListHeaderComponent={
            <Box className="pt-2 pb-5">
              <Heading className="text-xl font-bold text-foreground">Mis pedidos</Heading>
              <Text className="text-sm text-foreground-secondary mt-0.5">
                Lo que requiere atención está arriba.
              </Text>
            </Box>
          }
          ListEmptyComponent={
            loading ? (
              <OrdersLoadingRows />
            ) : (
              <EmptyState
                icon={<Receipt size={28} color={palette.brand} weight="duotone" />}
                title="Aún no tienes pedidos"
                description="Cuando solicites un servicio aparecerá aquí para que lo sigas."
                cta={{
                  label: 'Explorar servicios',
                  onPress: () => router.push('/(tabs)/services'),
                }}
              />
            )
          }
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          windowSize={7}
          removeClippedSubviews
          ItemSeparatorComponent={({ leadingItem }) =>
            leadingItem?.type === 'order' ? <Box style={styles.rowSeparator} /> : null
          }
        />
        <BottomFade />
      </Box>
    </ScreenShell>
  );
}

function SectionHeader({ label, count, muted }: { label: string; count: number; muted?: boolean }) {
  return (
    <HStack className="items-center gap-2 pb-1 pt-1">
      <Text
        style={{
          color: muted ? palette.textTertiary : palette.textSecondary,
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.6,
        }}
      >
        {label.toUpperCase()}
      </Text>
      <Text
        style={{
          color: palette.textTertiary,
          fontSize: 11,
          fontWeight: '600',
        }}
      >
        · {count}
      </Text>
    </HStack>
  );
}

function OrderRow({
  order,
  state,
  onPress,
}: {
  order: OrderListItem;
  state: WalletState;
  onPress: () => void;
}) {
  const status = estatusOrden[order.estatus];
  const colors = toneMap[status.tone];
  const muted = state === 'archived';

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <HStack className="items-center gap-3 py-3">
        <Box
          className="w-11 h-11 rounded-lg items-center justify-center"
          style={{ backgroundColor: muted ? palette.surfaceMuted : colors.bg }}
        >
          <Receipt size={20} color={muted ? palette.textTertiary : colors.fg} weight="duotone" />
        </Box>

        <VStack className="flex-1 gap-0.5">
          <HStack className="items-start justify-between gap-3">
            <Text
              className="flex-1 text-base font-semibold text-foreground"
              numberOfLines={1}
              style={{ opacity: muted ? 0.72 : 1 }}
            >
              {order.servicio_nombre}
            </Text>
            <Text className="text-sm font-bold text-foreground" numberOfLines={1}>
              {formatPrice(order.total)}
            </Text>
          </HStack>

          <Text className="text-sm text-foreground-secondary" numberOfLines={1}>
            {formatDateLong(order.fecha_creacion)}
            {order.prestador_nombre ? ` · ${order.prestador_nombre}` : ' · Asignación pendiente'}
          </Text>

          <HStack className="items-center justify-between gap-3">
            <Text className="text-xs text-foreground-secondary" numberOfLines={1}>
              #{order.id.slice(0, 8).toUpperCase()}
            </Text>
            <StatusPill label={status.label} tone={status.tone} />
          </HStack>
        </VStack>
      </HStack>
    </Pressable>
  );
}

function StatusPill({ label, tone }: { label: string; tone: Tone }) {
  const colors = toneMap[tone];
  return (
    <Box className="rounded-md px-2 py-1" style={{ backgroundColor: colors.bg }}>
      <Text style={{ color: colors.fg, fontSize: 11, fontWeight: '700' }} numberOfLines={1}>
        {label}
      </Text>
    </Box>
  );
}

function OrdersLoadingRows() {
  return (
    <VStack>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Box key={`orders-loading-${i}`}>
          <HStack className="items-center gap-3 py-3">
            <Skeleton width={44} height={44} radius={8} />
            <VStack className="flex-1 gap-2">
              <HStack className="items-center justify-between">
                <Skeleton width="52%" height={16} />
                <Skeleton width={52} height={16} />
              </HStack>
              <Skeleton width="72%" height={12} />
              <Skeleton width="38%" height={11} />
            </VStack>
          </HStack>
          {i < 5 ? <Box style={styles.rowSeparator} /> : null}
        </Box>
      ))}
    </VStack>
  );
}

function BottomFade() {
  return (
    <Box pointerEvents="none" className="absolute left-0 right-0 bottom-0 h-16">
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="ordersBottomFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={palette.surface} stopOpacity="0" />
            <Stop offset="0.72" stopColor={palette.surface} stopOpacity="0.92" />
            <Stop offset="1" stopColor={palette.surface} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#ordersBottomFade)" />
      </Svg>
    </Box>
  );
}

const styles = StyleSheet.create({
  rowSeparator: {
    borderBottomColor: palette.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginLeft: 56,
  },
});
