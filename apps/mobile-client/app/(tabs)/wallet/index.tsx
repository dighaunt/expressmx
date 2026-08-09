import { useFocusEffect, useRouter } from 'expo-router';
import {
  ArrowDown,
  ArrowUp,
  ArrowUUpLeft,
  CaretRight,
  Coins,
  Receipt,
  Wallet as WalletIcon,
} from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { ListRowSkeleton } from '@/components/ui-app/list-row-skeleton';
import { ScreenHeader } from '@/components/ui-app/screen-header';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { Skeleton } from '@/components/ui-app/skeleton';
import { StatusBadge } from '@/components/ui-app/status-badge';
import { api } from '@/lib/api/client';
import { formatDateLong, formatPrice } from '@/lib/format';
import { palette, type Tone } from '@/lib/theme/tokens';

type MovimientoTipo =
  | 'credito_manual'
  | 'credito_compensacion'
  | 'aplicacion_orden'
  | 'reverso'
  | 'ajuste_admin';

type ReembolsoEstatus = 'solicitado' | 'aprobado' | 'procesado' | 'rechazado';

interface Movimiento {
  id: string;
  tipo: MovimientoTipo;
  monto_mxn: number;
  motivo_md: string;
  ticket_id: string | null;
  orden_id: string | null;
  created_at: string;
}

interface Reembolso {
  id: string;
  monto: number;
  motivo: string;
  estatus: ReembolsoEstatus;
  created_at: string;
  referencia_pasarela: string | null;
  payment_intent_id: string | null;
  ticket_id: string | null;
  ticket_asunto: string | null;
}

interface WalletResponse {
  data: {
    saldo: number;
    movimientos: Movimiento[];
    reembolsos: Reembolso[];
  };
}

const movimientoLabel: Record<MovimientoTipo, string> = {
  credito_manual: 'Crédito manual',
  credito_compensacion: 'Crédito por compensación',
  aplicacion_orden: 'Aplicado a un pedido',
  reverso: 'Reverso',
  ajuste_admin: 'Ajuste de soporte',
};

const reembolsoStatus: Record<ReembolsoEstatus, { label: string; tone: Tone }> = {
  solicitado: { label: 'Solicitado', tone: 'warning' },
  aprobado: { label: 'Aprobado', tone: 'info' },
  procesado: { label: 'Procesado', tone: 'success' },
  rechazado: { label: 'Rechazado', tone: 'danger' },
};

type Tab = 'movimientos' | 'reembolsos';

export default function WalletScreen() {
  const router = useRouter();
  const [saldo, setSaldo] = useState<number>(0);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [reembolsos, setReembolsos] = useState<Reembolso[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('movimientos');

  const load = useCallback(async () => {
    try {
      const response = await api.get<WalletResponse>('/v1/mobile/wallet');
      setSaldo(response.data.saldo ?? 0);
      setMovimientos(response.data.movimientos ?? []);
      setReembolsos(response.data.reembolsos ?? []);
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

  return (
    <ScreenShell>
      <ScreenHeader title="Mi billetera" showBack={false} />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={palette.brand} />
        }
      >
        <VStack className="gap-5">
          <Box className="bg-primary-soft rounded-2xl p-5">
            <HStack className="items-center gap-3 mb-3">
              <Box className="w-11 h-11 rounded-xl bg-card items-center justify-center">
                <WalletIcon size={22} color={palette.brandStrong} weight="fill" />
              </Box>
              <VStack className="flex-1">
                <Text className="text-xs font-bold text-primary-strong uppercase tracking-wide">
                  Saldo disponible
                </Text>
                <Text className="text-xs text-foreground-secondary">
                  Disponible para tu próximo servicio
                </Text>
              </VStack>
            </HStack>
            <Heading className="text-3xl font-bold text-primary-strong">
              {formatPrice(saldo, true)}
            </Heading>
          </Box>

          <HStack className="gap-2 bg-muted rounded-xl p-1">
            <Pressable
              onPress={() => setTab('movimientos')}
              className="flex-1"
              hitSlop={4}
            >
              <Box
                className={
                  'rounded-lg py-2.5 items-center ' +
                  (tab === 'movimientos' ? 'bg-card' : 'bg-transparent')
                }
              >
                <Text
                  className={
                    'text-sm font-semibold ' +
                    (tab === 'movimientos' ? 'text-foreground' : 'text-foreground-secondary')
                  }
                >
                  Saldo
                </Text>
              </Box>
            </Pressable>
            <Pressable
              onPress={() => setTab('reembolsos')}
              className="flex-1"
              hitSlop={4}
            >
              <Box
                className={
                  'rounded-lg py-2.5 items-center ' +
                  (tab === 'reembolsos' ? 'bg-card' : 'bg-transparent')
                }
              >
                <Text
                  className={
                    'text-sm font-semibold ' +
                    (tab === 'reembolsos' ? 'text-foreground' : 'text-foreground-secondary')
                  }
                >
                  Reembolsos
                </Text>
              </Box>
            </Pressable>
          </HStack>

          {loading ? (
            <VStack className="gap-2">
              <Skeleton width="40%" height={11} />
              <ListRowSkeleton showLeading />
              <ListRowSkeleton showLeading />
              <ListRowSkeleton showLeading />
              <ListRowSkeleton showLeading />
            </VStack>
          ) : tab === 'movimientos' ? (
            movimientos.length === 0 ? (
              <VStack className="py-8 px-5 rounded-xl bg-muted items-center gap-3">
                <Box className="w-12 h-12 rounded-xl bg-background items-center justify-center">
                  <Coins size={24} color={palette.brand} weight="duotone" />
                </Box>
                <VStack className="gap-1 items-center">
                  <Text className="text-base font-semibold text-foreground">
                    Aún no hay movimientos
                  </Text>
                  <Text className="text-sm text-foreground-secondary text-center">
                    Cuando recibas un crédito o lo apliquemos a un pedido, lo verás aquí.
                  </Text>
                </VStack>
              </VStack>
            ) : (
              <VStack>
                {movimientos.map((m, index) => {
                  const positivo = m.monto_mxn > 0;
                  const Icon = positivo ? ArrowUp : m.tipo === 'reverso' ? ArrowUUpLeft : ArrowDown;
                  return (
                    <Box key={m.id}>
                      <HStack className="items-start gap-3 py-3">
                        <Box className={`w-10 h-10 rounded-lg items-center justify-center ${positivo ? 'bg-success-soft' : 'bg-muted'}`}>
                          <Icon size={18} color={positivo ? palette.success : palette.textSecondary} weight="bold" />
                        </Box>
                        <VStack className="flex-1 gap-0.5">
                          <HStack className="items-start justify-between gap-3">
                            <Text className="flex-1 text-sm font-semibold text-foreground" numberOfLines={1}>
                              {movimientoLabel[m.tipo]}
                            </Text>
                            <Text className={`text-sm font-bold ${positivo ? 'text-success' : 'text-foreground'}`} numberOfLines={1}>
                              {positivo ? '+' : ''}{formatPrice(m.monto_mxn, true)}
                            </Text>
                          </HStack>
                          <Text className="text-sm text-foreground-secondary" numberOfLines={1}>
                            {m.motivo_md}
                          </Text>
                          <Text className="text-xs text-foreground-secondary">
                            {formatDateLong(m.created_at)}
                          </Text>
                        </VStack>
                      </HStack>
                      {index < movimientos.length - 1 ? <Box style={styles.separator} /> : null}
                    </Box>
                  );
                })}
              </VStack>
            )
          ) : reembolsos.length === 0 ? (
            <VStack className="py-8 px-5 rounded-xl bg-muted items-center gap-3">
              <Box className="w-12 h-12 rounded-xl bg-background items-center justify-center">
                <Receipt size={24} color={palette.brand} weight="duotone" />
              </Box>
              <VStack className="gap-1 items-center">
                <Text className="text-base font-semibold text-foreground">
                  Sin reembolsos
                </Text>
                <Text className="text-sm text-foreground-secondary text-center">
                  Si abres un reporte y procede un reembolso, lo verás aquí.
                </Text>
              </VStack>
            </VStack>
          ) : (
            <VStack>
              {reembolsos.map((r, index) => {
                const status = reembolsoStatus[r.estatus];
                const inner = (
                  <Box>
                    <HStack className="items-center gap-3 py-3">
                      <Box className="w-10 h-10 rounded-lg bg-muted items-center justify-center">
                        <Receipt size={18} color={palette.textSecondary} weight="duotone" />
                      </Box>
                      <VStack className="flex-1 gap-0.5">
                        <HStack className="items-start justify-between gap-3">
                          <Text className="flex-1 text-sm font-semibold text-foreground" numberOfLines={1}>
                            {r.motivo}
                          </Text>
                          <Text className="text-sm font-bold text-foreground" numberOfLines={1}>
                            {formatPrice(r.monto, true)}
                          </Text>
                        </HStack>
                        <Text className="text-xs text-foreground-secondary">
                        {formatDateLong(r.created_at)}
                        </Text>
                      </VStack>
                      <VStack className="items-end gap-1">
                        <StatusBadge label={status.label} tone={status.tone} />
                        {r.ticket_id ? (
                          <HStack className="items-center gap-1">
                            <Text className="text-xs font-semibold text-primary">Ver</Text>
                            <CaretRight size={12} color={palette.brand} weight="bold" />
                          </HStack>
                        ) : null}
                      </VStack>
                    </HStack>
                    {index < reembolsos.length - 1 ? <Box style={styles.separator} /> : null}
                  </Box>
                );
                if (r.ticket_id) {
                  return (
                    <Pressable
                      key={r.id}
                      onPress={() => router.push(`/support/${r.ticket_id}`)}
                    >
                      {inner}
                    </Pressable>
                  );
                }
                return <Box key={r.id}>{inner}</Box>;
              })}
            </VStack>
          )}
        </VStack>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  separator: {
    borderBottomColor: palette.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginLeft: 52,
  },
});
