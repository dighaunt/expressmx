import { useFocusEffect, useRouter } from 'expo-router';
import { Briefcase, CaretRight, Wrench } from 'phosphor-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { ListRowSkeleton } from '@/components/ui-app/list-row-skeleton';
import { EmptyState } from '@/components/ui-app/empty-state';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { StatusBadge } from '@/components/ui-app/status-badge';
import { api } from '@/lib/api/client';
import { addRealtimeListener } from '@/lib/realtime';
import {
  estatusOrdenLabel,
  estatusOrdenTone,
  palette,
  type EstatusOrden,
} from '@/lib/theme/tokens';

interface JobItem {
  id: string;
  servicio: string;
  cliente: string;
  hora: string;
  zona: string;
  estatus: EstatusOrden;
}

interface JobsResponse {
  data: JobItem[];
}

type FilterKey = 'todos' | 'asignada' | 'en_progreso' | 'completada';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'asignada', label: 'Asignados' },
  { key: 'en_progreso', label: 'En curso' },
  { key: 'completada', label: 'Completados' },
];

export default function ProviderJobs() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>('todos');
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await api.get<JobsResponse>('/v1/mobile/provider/jobs?limit=40');
      setJobs(response.data ?? []);
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

  const filtered = useMemo(() => {
    if (filter === 'todos') return jobs;
    return jobs.filter((j) => j.estatus === filter);
  }, [jobs, filter]);

  return (
    <ScreenShell applyBottomInset={false}>
      <Box className="px-5 pt-2 pb-3">
        <Heading className="text-2xl font-bold text-foreground">Servicios</Heading>
        <Text className="text-sm text-foreground-secondary mt-0.5">
          Tus órdenes asignadas e historial.
        </Text>
      </Box>

      <Box className="pb-3">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        >
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable key={f.key} onPress={() => setFilter(f.key)}>
                <Box
                  className={`px-3.5 py-1.5 rounded-full border ${
                    active ? 'bg-primary border-primary' : 'bg-card border-border'
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      active ? 'text-primary-foreground' : 'text-foreground'
                    }`}
                  >
                    {f.label}
                  </Text>
                </Box>
              </Pressable>
            );
          })}
        </ScrollView>
      </Box>

      <Box className="flex-1">
        {loading && jobs.length === 0 ? (
          <Box className="px-5">
            <VStack className="gap-2">
              <ListRowSkeleton showLeading />
              <ListRowSkeleton showLeading />
              <ListRowSkeleton showLeading />
              <ListRowSkeleton showLeading />
              <ListRowSkeleton showLeading />
            </VStack>
          </Box>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            contentInsetAdjustmentBehavior="automatic"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={palette.brand}
              />
            }
            ItemSeparatorComponent={() => <Box style={styles.separator} />}
            ListEmptyComponent={
              <EmptyState
                icon={<Briefcase size={28} color={palette.brand} weight="duotone" />}
                title={filter === 'todos' ? 'Sin órdenes asignadas' : 'Sin órdenes en este filtro'}
                description={
                  filter === 'todos'
                    ? 'Cuando ExpressMX te mande una orden aparecerá aquí.'
                    : undefined
                }
              />
            }
            renderItem={({ item: j }) => (
              <Pressable
                onPress={() => router.push({ pathname: '/jobs/[id]', params: { id: j.id } })}
                accessibilityRole="button"
              >
                <HStack className="items-center gap-3 py-3">
                  <Box className="w-11 h-11 rounded-lg bg-muted items-center justify-center">
                    <Wrench size={20} color={palette.brandStrong} />
                  </Box>
                  <VStack className="flex-1 gap-0.5">
                    <HStack className="items-start justify-between gap-3">
                      <Text
                        className="flex-1 text-base font-semibold text-foreground"
                        numberOfLines={1}
                      >
                        {j.servicio}
                      </Text>
                      <StatusBadge
                        label={estatusOrdenLabel[j.estatus]}
                        tone={estatusOrdenTone[j.estatus]}
                      />
                    </HStack>
                    <Text className="text-sm text-foreground-secondary" numberOfLines={1}>
                      {j.hora} · {j.zona}
                    </Text>
                    <Text className="text-xs text-foreground-secondary" numberOfLines={1}>
                      #{j.id.slice(0, 8).toUpperCase()} · {j.cliente}
                    </Text>
                  </VStack>
                  <CaretRight size={18} color={palette.textDisabled} />
                </HStack>
              </Pressable>
            )}
            showsVerticalScrollIndicator={false}
          />
        )}
        <BottomFade />
      </Box>
    </ScreenShell>
  );
}

function BottomFade() {
  return (
    <Box pointerEvents="none" className="absolute left-0 right-0 bottom-0 h-16">
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="providerJobsBottomFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={palette.surface} stopOpacity="0" />
            <Stop offset="0.72" stopColor={palette.surface} stopOpacity="0.92" />
            <Stop offset="1" stopColor={palette.surface} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#providerJobsBottomFade)" />
      </Svg>
    </Box>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 48,
    flexGrow: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 56,
    backgroundColor: palette.border,
  },
});
