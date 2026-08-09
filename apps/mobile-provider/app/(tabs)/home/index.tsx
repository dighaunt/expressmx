import { useFocusEffect, useRouter } from 'expo-router';
import { Bell, Wrench } from 'phosphor-react-native';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { KpiCard } from '@/components/ui-app/kpi-card';
import { InlineAlert } from '@/components/ui-app/inline-alert';
import { PrimaryButton } from '@/components/ui-app/primary-button';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { api, ApiError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/use-session';
import { addRealtimeListener } from '@/lib/realtime';
import { formatMxn, palette, spacing } from '@/lib/theme/tokens';

interface DashboardSummary {
  servicios_hoy: number;
  bono_hoy: number;
  bono_semana: number;
  sueldo_base_quincenal: number;
  servicios_completados_total: number;
  semana_barras: number[];
  proxima_orden: {
    id: string;
    servicio: string;
    hora: string;
    zona: string;
    cliente: string;
  } | null;
}

interface DashboardResponse {
  data: DashboardSummary;
}

interface AvailabilityState {
  online: boolean;
  zona: string | null;
}

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function todayIndex(): number {
  const day = new Date().getDay();
  return day === 0 ? 6 : day - 1;
}

const FALLBACK: DashboardSummary = {
  servicios_hoy: 0,
  bono_hoy: 0,
  bono_semana: 0,
  sueldo_base_quincenal: 0,
  servicios_completados_total: 0,
  semana_barras: [0, 0, 0, 0, 0, 0, 0],
  proxima_orden: null,
};

export default function ProviderHome() {
  const router = useRouter();
  const { user, logout } = useSession();
  const [summary, setSummary] = useState<DashboardSummary>(FALLBACK);
  const [availability, setAvailability] = useState<AvailabilityState>({ online: false, zona: null });
  const [unread, setUnread] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [dash, avail, notif] = await Promise.all([
        api.get<DashboardResponse>('/v1/mobile/provider/dashboard'),
        api.get<{ data: AvailabilityState }>('/v1/mobile/provider/availability/state'),
        api.get<{ data: { id: string }[] }>('/v1/mobile/notifications?no_leidas=true&limit=1'),
      ]);
      setSummary(dash.data);
      setAvailability(avail.data);
      setUnread(notif.data?.length ?? 0);
      setSyncError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await logout();
        router.replace('/(auth)/login');
        return;
      }
      const detail = err instanceof ApiError ? err.message : 'Revisa tu conexión e inténtalo de nuevo.';
      setSyncError(detail);
    }
  }, [logout, router]);

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

  const initials = (user ? `${user.nombre.charAt(0)}${user.apellidos.charAt(0)}` : '··').toUpperCase();
  const firstName = user?.nombre ?? 'Bienvenido';
  const todayIdx = todayIndex();

  return (
    <ScreenShell applyBottomInset={false}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.bottomSafe }}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={palette.brand} />
        }
      >
        <Box className="px-5 pt-2 pb-4">
          <HStack className="items-center gap-3">
            <Box className="w-11 h-11 rounded-full bg-primary-soft items-center justify-center">
              <Text className="text-base font-bold text-primary-strong">{initials}</Text>
            </Box>
            <VStack className="flex-1">
              <Text className="text-xs text-foreground-secondary">Hola,</Text>
              <Heading className="text-lg font-bold text-foreground" numberOfLines={1}>
                {firstName}
              </Heading>
            </VStack>
            <Pressable
              onPress={() => router.push('/notifications')}
              hitSlop={10}
              className="w-11 h-11 rounded-xl bg-muted items-center justify-center"
            >
              <Bell size={22} color={palette.textPrimary} />
              {unread > 0 ? (
                <Box className="absolute top-2 right-2 w-2 h-2 rounded-sm bg-destructive" />
              ) : null}
            </Pressable>
          </HStack>
        </Box>

        <Box className="px-5">
          {syncError ? (
            <Box className="mb-3">
              <InlineAlert
                tone="warning"
                title="No pudimos sincronizar tu turno"
                message={syncError}
              />
            </Box>
          ) : null}

          <Box
            className={`rounded-xl p-3.5 border ${
              availability.online
                ? 'bg-primary-soft border-border'
                : 'bg-card border-border'
            }`}
          >
            <HStack className="items-center gap-3">
              <Box
                className={`w-11 h-11 rounded-xl items-center justify-center ${
                  availability.online ? 'bg-card' : 'bg-muted'
                }`}
              >
                <Wrench
                  size={22}
                  color={availability.online ? palette.brandStrong : palette.textTertiary}
                  weight={availability.online ? 'duotone' : 'regular'}
                />
              </Box>
              <VStack className="flex-1">
                <HStack className="items-center gap-2">
                  <Heading className="text-base font-bold text-foreground">
                    {availability.online ? 'Turno asignado' : 'Sin turno activo'}
                  </Heading>
                  <Box
                    className={`px-2 py-0.5 rounded-full ${
                      availability.online ? 'bg-success-soft' : 'bg-muted'
                    }`}
                  >
                    <Text
                      className={`text-[10px] font-bold uppercase ${
                        availability.online ? 'text-success' : 'text-muted-foreground'
                      }`}
                    >
                      {availability.online ? 'Asignable' : 'Sin turno'}
                    </Text>
                  </Box>
                </HStack>
                <Text className="text-xs text-foreground-secondary mt-0.5">
                  {availability.online
                    ? availability.zona
                      ? `Operaciones puede asignarte servicios en ${availability.zona}`
                      : 'Operaciones puede asignarte servicios'
                    : 'Consulta tu horario asignado con tu supervisor'}
                </Text>
              </VStack>
            </HStack>
          </Box>
        </Box>

        <Box className="px-5 mt-4">
          {syncError ? (
            <Box className="mb-3">
              <PrimaryButton onPress={load} loading={refreshing} variant="outline">
                Reintentar sincronización
              </PrimaryButton>
            </Box>
          ) : null}

          <Box className="bg-card border border-border rounded-xl p-3.5">
            <Text className="text-xs text-foreground-secondary">Servicios completados hoy</Text>
            <HStack className="items-baseline gap-2 mt-1">
              <Heading className="text-3xl font-bold text-primary">
                {summary.servicios_hoy}
              </Heading>
              <Text className="text-xs text-foreground-secondary">
                bono {formatMxn(summary.bono_hoy)}
              </Text>
            </HStack>
            <Box className="mt-3 flex-row items-end gap-1.5 h-12">
              {summary.semana_barras.map((h, i) => (
                <Box
                  key={i}
                  className={`flex-1 rounded-sm ${i === todayIdx ? 'bg-primary' : 'bg-muted'}`}
                  style={{ height: `${Math.max(h, 4)}%` }}
                />
              ))}
            </Box>
            <HStack className="justify-between mt-1">
              {WEEKDAYS.map((d, i) => (
                <Text
                  key={i}
                  className={`text-[10px] ${i === todayIdx ? 'text-primary font-bold' : 'text-foreground-secondary'}`}
                >
                  {d}
                </Text>
              ))}
            </HStack>
          </Box>
        </Box>

        <Box className="px-5 mt-3">
          <HStack className="gap-3">
            <Box className="flex-1">
              <KpiCard
                label="Bonos esta semana"
                value={formatMxn(summary.bono_semana)}
                hint={`+ sueldo base ${formatMxn(summary.sueldo_base_quincenal)}`}
                accent
              />
            </Box>
            <Box className="flex-1">
              <KpiCard
                label="Servicios completados"
                value={String(summary.servicios_completados_total)}
                hint="Histórico operativo"
              />
            </Box>
          </HStack>
        </Box>

        {summary.proxima_orden ? (
          <Box className="px-5 mt-6">
            <Heading className="text-base font-bold text-foreground mb-2">Próxima orden</Heading>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/jobs/[id]',
                  params: { id: summary.proxima_orden!.id },
                })
              }
            >
              <Box className="bg-card border border-border rounded-xl p-3">
                <HStack className="items-center gap-3">
                  <Box className="w-10 h-10 rounded-lg bg-muted items-center justify-center">
                    <Wrench size={20} color={palette.brandStrong} />
                  </Box>
                  <VStack className="flex-1">
                    <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                      {summary.proxima_orden.servicio} · #{summary.proxima_orden.id.slice(0, 8).toUpperCase()}
                    </Text>
                    <Text className="text-xs text-foreground-secondary" numberOfLines={1}>
                      {summary.proxima_orden.hora} · {summary.proxima_orden.zona} · {summary.proxima_orden.cliente}
                    </Text>
                  </VStack>
                  <Box className="px-2.5 py-1 rounded-md bg-primary-soft">
                    <Text className="text-xs font-semibold text-primary-strong">Ver</Text>
                  </Box>
                </HStack>
              </Box>
            </Pressable>
          </Box>
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}
