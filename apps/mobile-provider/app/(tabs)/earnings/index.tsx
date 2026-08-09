import { useFocusEffect } from 'expo-router';
import { Wallet, Wrench } from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { EmptyState } from '@/components/ui-app/empty-state';
import { api } from '@/lib/api/client';
import { formatMxn, palette } from '@/lib/theme/tokens';

type Range = 'hoy' | 'semana' | 'mes' | 'anio';

interface EarningsItem {
  id: string;
  fecha: string;
  servicio: string;
  duracion: string;
  detalle: string;
  monto: number;
}

interface EarningsSummary {
  rango: Range;
  total: number;
  servicios: number;
  sueldo_base_quincenal: number;
  trayectoria: number[];
  proxima_quincena: {
    fecha: string;
    cuenta: string | null;
    monto_estimado: number;
  } | null;
  recientes: EarningsItem[];
}

interface EarningsResponse {
  data: EarningsSummary;
}

const RANGES: { key: Range; label: string }[] = [
  { key: 'hoy', label: 'Hoy' },
  { key: 'semana', label: 'Esta semana' },
  { key: 'mes', label: 'Mes' },
  { key: 'anio', label: 'Año' },
];

const FALLBACK: EarningsSummary = {
  rango: 'semana',
  total: 0,
  servicios: 0,
  sueldo_base_quincenal: 0,
  trayectoria: [50, 50, 50, 50, 50, 50, 50],
  proxima_quincena: null,
  recientes: [],
};

function trayectoriaToPath(values: number[]): { line: string; area: string } {
  if (values.length < 2) return { line: '', area: '' };
  const max = Math.max(...values, 1);
  const stepX = 300 / (values.length - 1);
  const points = values.map((v, i) => {
    const y = 60 - (v / max) * 56;
    return `${(i * stepX).toFixed(2)} ${y.toFixed(2)}`;
  });
  const line = `M${points.join(' L')}`;
  const area = `${line} L300 60 L0 60 z`;
  return { line, area };
}

export default function ProviderEarnings() {
  const [range, setRange] = useState<Range>('semana');
  const [summary, setSummary] = useState<EarningsSummary>(FALLBACK);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (r: Range) => {
    try {
      const response = await api.get<EarningsResponse>(
        `/v1/mobile/provider/earnings?rango=${r}`,
      );
      if (response?.data) setSummary(response.data);
    } catch {
      void 0;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(range);
    }, [load, range]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await load(range);
    setRefreshing(false);
  }

  const { line, area } = trayectoriaToPath(summary.trayectoria);

  return (
    <ScreenShell applyBottomInset={false}>
      <Box className="px-5 pt-2 pb-3">
        <Heading className="text-2xl font-bold text-foreground">Mis bonos</Heading>
        <Text className="text-sm text-foreground-secondary mt-0.5">
          Sueldo base + bonos por servicio · pagados quincenalmente.
        </Text>
      </Box>

      <Box className="pb-3">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        >
          {RANGES.map((r) => {
            const active = range === r.key;
            return (
              <Pressable key={r.key} onPress={() => setRange(r.key)}>
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
                    {r.label}
                  </Text>
                </Box>
              </Pressable>
            );
          })}
        </ScrollView>
      </Box>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={palette.brand} />
        }
      >
        <Box className="bg-primary-soft rounded-xl p-4">
          <Text className="text-xs text-primary-strong font-semibold uppercase tracking-wide">
            Bonos {RANGES.find((r) => r.key === range)?.label.toLowerCase()}
          </Text>
          <Heading className="text-3xl font-bold text-primary mt-1">
            {formatMxn(summary.total)}
          </Heading>
          <Text className="text-xs text-foreground-secondary">
            {summary.servicios} servicios · sueldo base {formatMxn(summary.sueldo_base_quincenal)} quincenal
          </Text>
          {line ? (
            <Box className="mt-3">
              <Svg width="100%" height={64} viewBox="0 0 300 60" preserveAspectRatio="none">
                <Path d={area} fill="rgba(37,99,235,0.18)" />
                <Path d={line} stroke={palette.brand} strokeWidth={2} fill="none" />
              </Svg>
            </Box>
          ) : null}
        </Box>

        <HStack className="items-baseline justify-between mt-6 mb-2">
          <Heading className="text-base font-bold text-foreground">Servicios recientes</Heading>
          <Text className="text-xs text-foreground-secondary">
            {summary.recientes.length} en este rango
          </Text>
        </HStack>

        {summary.recientes.length === 0 ? (
          <EmptyState
            icon={<Wrench size={28} color={palette.brand} weight="duotone" />}
            title="Sin servicios en este rango"
            description="Cuando termines un trabajo verás aquí el bono que ganaste."
          />
        ) : (
          <VStack className="gap-1">
            {summary.recientes.map((it, i) => (
              <HStack
                key={it.id}
                className={`items-center gap-3 py-3 ${i < summary.recientes.length - 1 ? 'border-b border-border' : ''}`}
              >
                <Box className="w-10 h-10 rounded-lg bg-muted items-center justify-center">
                  <Wrench size={18} color={palette.brandStrong} />
                </Box>
                <VStack className="flex-1">
                  <Text className="text-sm font-bold text-foreground">{it.servicio}</Text>
                  <Text className="text-xs text-foreground-secondary">
                    {it.fecha} · {it.duracion} · {it.detalle}
                  </Text>
                </VStack>
                <Text className="text-base font-bold text-primary">+{formatMxn(it.monto)}</Text>
              </HStack>
            ))}
          </VStack>
        )}

        {summary.proxima_quincena ? (
          <Box className="mt-6 bg-card border border-border rounded-xl p-3.5">
            <HStack className="items-center gap-3">
              <Box className="w-11 h-11 rounded-full bg-primary-soft items-center justify-center">
                <Wallet size={20} color={palette.brandStrong} weight="fill" />
              </Box>
              <VStack className="flex-1">
                <Text className="text-sm font-bold text-foreground">Próxima quincena</Text>
                <Text className="text-xs text-foreground-secondary">
                  {summary.proxima_quincena.fecha}
                  {summary.proxima_quincena.cuenta
                    ? ` · ${summary.proxima_quincena.cuenta}`
                    : ''}
                </Text>
              </VStack>
              <Text className="text-base font-bold text-foreground">
                {formatMxn(summary.proxima_quincena.monto_estimado)}
              </Text>
            </HStack>
          </Box>
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}
