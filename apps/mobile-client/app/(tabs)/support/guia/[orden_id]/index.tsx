import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  CaretRight,
  CheckCircle,
  ChatCircleDots,
  CurrencyCircleDollar,
  DotsThreeOutline,
  User,
  WarningCircle,
  XCircle,
} from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { ScrollView } from 'react-native';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { ScreenHeader } from '@/components/ui-app/screen-header';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { api } from '@/lib/api/client';
import { formatDateLong, formatPrice } from '@/lib/format';
import { palette } from '@/lib/theme/tokens';

type Categoria = 'cobro_incorrecto' | 'no_show' | 'dano_propiedad' | 'queja_servicio' | 'otro';

interface OrderDetail {
  id: string;
  servicio_nombre: string;
  total: number;
  fecha_creacion: string | null;
  fecha_programada: string | null;
  refund_eligibility: {
    eligible: boolean;
    requires_manual_review: boolean;
    reason:
      | 'candidato'
      | 'sin_cargo_procesado'
      | 'reembolso_existente'
      | 'orden_activa'
      | 'revision_manual';
    processed_amount: number;
    refunded_amount: number;
  };
}

interface OrderDetailResponse {
  orden: OrderDetail;
}

interface ArticuloItem {
  id: string;
  slug: string;
  titulo: string;
  resumen: string | null;
}

interface ArticulosResponse {
  data: ArticuloItem[];
}

interface CategoriaSpec {
  value: Categoria;
  label: string;
  helper: string;
  Icon: typeof CurrencyCircleDollar;
  iconColor: string;
  skipDeflection: boolean;
}

type ReembolsoMotivo =
  | 'cobro_duplicado'
  | 'monto_incorrecto'
  | 'servicio_no_recibido'
  | 'cargo_no_reconocido';

const REFUND_REASONS: {
  value: ReembolsoMotivo;
  label: string;
  helper: string;
}[] = [
  {
    value: 'cobro_duplicado',
    label: 'Cobro duplicado',
    helper: 'Ves dos cargos por el mismo pedido.',
  },
  {
    value: 'monto_incorrecto',
    label: 'Monto incorrecto',
    helper: 'El cargo no coincide con el total del pedido.',
  },
  {
    value: 'servicio_no_recibido',
    label: 'Servicio no recibido',
    helper: 'Pagaste, pero el servicio no se completó.',
  },
  {
    value: 'cargo_no_reconocido',
    label: 'Cargo no reconocido',
    helper: 'No identificas el cargo y requiere revisión especial.',
  },
];

const REFUND_REASON_TEXT: Record<OrderDetail['refund_eligibility']['reason'], string> = {
  candidato: 'Tu pedido cumple los criterios iniciales para solicitar reembolso.',
  sin_cargo_procesado: 'No encontramos un cargo procesado para reembolsar.',
  reembolso_existente: 'Este pedido ya tiene un reembolso o una solicitud activa.',
  orden_activa: 'Espera a que el pedido termine o sea cancelado para revisar reembolso.',
  revision_manual: 'Necesitamos revisión especializada antes de aceptar otro reembolso.',
};

const CATEGORIES: CategoriaSpec[] = [
  {
    value: 'cobro_incorrecto',
    label: 'Cobro incorrecto',
    helper: 'Te cobraron de más, doble cargo, o monto distinto.',
    Icon: CurrencyCircleDollar,
    iconColor: palette.brand,
    skipDeflection: false,
  },
  {
    value: 'no_show',
    label: 'No llegó el prestador',
    helper: 'Reservaste y nadie se presentó.',
    Icon: User,
    iconColor: palette.warning,
    skipDeflection: false,
  },
  {
    value: 'dano_propiedad',
    label: 'Daño a tu propiedad',
    helper: 'Algo se rompió o se manchó durante el servicio.',
    Icon: WarningCircle,
    iconColor: palette.danger,
    skipDeflection: true,
  },
  {
    value: 'queja_servicio',
    label: 'Queja del servicio',
    helper: 'Mala atención, retraso, mal trato.',
    Icon: ChatCircleDots,
    iconColor: palette.info,
    skipDeflection: false,
  },
  {
    value: 'otro',
    label: 'Otro',
    helper: 'Cuéntanos lo que pasó.',
    Icon: DotsThreeOutline,
    iconColor: palette.textSecondary,
    skipDeflection: true,
  },
];

export default function GuiaScreen() {
  const router = useRouter();
  const { orden_id } = useLocalSearchParams<{ orden_id: string }>();

  const [orden, setOrden] = useState<OrderDetail | null>(null);
  const [loadingOrden, setLoadingOrden] = useState(true);
  const [missing, setMissing] = useState(false);

  const [seleccionada, setSeleccionada] = useState<CategoriaSpec | null>(null);
  const [refundReason, setRefundReason] = useState<ReembolsoMotivo | null>(null);
  const [sugerencias, setSugerencias] = useState<ArticuloItem[]>([]);
  const [loadingSugerencias, setLoadingSugerencias] = useState(false);

  const loadOrden = useCallback(async () => {
    if (!orden_id) return;
    try {
      const response = await api.get<OrderDetailResponse>(
        `/v1/mobile/orders/${orden_id}`,
      );
      setOrden(response.orden);
    } catch {
      setMissing(true);
    } finally {
      setLoadingOrden(false);
    }
  }, [orden_id]);

  useFocusEffect(
    useCallback(() => {
      void loadOrden();
    }, [loadOrden]),
  );

  async function handleCategoriaPress(spec: CategoriaSpec) {
    setRefundReason(null);
    if (spec.skipDeflection) {
      router.push(`/orders/${orden_id}/reportar-problema?categoria=${spec.value}`);
      return;
    }
    setSeleccionada(spec);
    setLoadingSugerencias(true);
    setSugerencias([]);
    try {
      const response = await api.get<ArticulosResponse>(
        `/v1/mobile/kb/articulos?categoria=${spec.value}&limit=3`,
      );
      setSugerencias(response.data ?? []);
    } catch {
      setSugerencias([]);
    } finally {
      setLoadingSugerencias(false);
    }
  }

  function continuarReporte() {
    if (!seleccionada || !orden) return;
    if (seleccionada.value === 'cobro_incorrecto') {
      const eligibility = orden.refund_eligibility;
      if (!refundReason) return;
      if (!eligibility.eligible && !eligibility.requires_manual_review) return;
      router.push(
        `/orders/${orden_id}/reportar-problema?categoria=${seleccionada.value}&motivo_reembolso=${refundReason}&elegibilidad=${eligibility.eligible ? 'candidato' : 'revision_manual'}`,
      );
      return;
    }
    router.push(`/orders/${orden_id}/reportar-problema?categoria=${seleccionada.value}`);
  }

  if (loadingOrden) {
    return (
      <ScreenShell>
        <ScreenHeader title="¿Qué pasó?" />
        <Box className="flex-1 items-center justify-center">
          <Spinner color={palette.brand} />
        </Box>
      </ScreenShell>
    );
  }

  if (missing || !orden) {
    return (
      <ScreenShell>
        <ScreenHeader title="¿Qué pasó?" />
        <Box className="flex-1 items-center justify-center px-6">
          <Text className="text-base font-semibold text-foreground text-center">
            No encontramos este pedido
          </Text>
          <Text className="mt-1 text-sm text-foreground-secondary text-center">
            Vuelve y selecciona otro pedido.
          </Text>
        </Box>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell applyBottomInset={false}>
      <ScreenHeader
        title={seleccionada ? '¿Algo de esto te ayuda?' : '¿Qué pasó con tu pedido?'}
      />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <VStack className="gap-4">
          <Box className="bg-muted rounded-xl p-4">
            <Text className="text-xs text-foreground-secondary uppercase tracking-wide font-bold mb-1">
              Pedido
            </Text>
            <Text className="text-base font-bold text-foreground" numberOfLines={2}>
              {orden.servicio_nombre}
            </Text>
            <HStack className="items-center justify-between mt-1">
              <Text className="text-xs text-foreground-secondary">
                #{orden.id.slice(0, 8).toUpperCase()}
                {orden.fecha_creacion ? ` · ${formatDateLong(orden.fecha_creacion)}` : ''}
              </Text>
              <Text className="text-sm font-semibold text-foreground">
                {formatPrice(orden.total)}
              </Text>
            </HStack>
          </Box>

          {seleccionada ? (
            <VStack className="gap-3">
              {seleccionada.value === 'cobro_incorrecto' ? (
                <RefundFlow
                  orden={orden}
                  selectedReason={refundReason}
                  onSelectReason={setRefundReason}
                  onContinue={continuarReporte}
                />
              ) : (
                <>
                  <Text className="text-sm text-foreground-secondary">
                    Antes de reportar, ¿alguno de estos artículos te resuelve?
                  </Text>
                  {loadingSugerencias ? (
                    <Box className="py-6 items-center">
                      <Spinner color={palette.brand} />
                    </Box>
                  ) : sugerencias.length === 0 ? (
                    <Box className="py-5 px-4 rounded-xl bg-muted">
                      <Text className="text-sm text-foreground-secondary text-center">
                        No tenemos artículos para esto. Continúa con tu reporte.
                      </Text>
                    </Box>
                  ) : (
                    <VStack className="gap-2">
                      {sugerencias.map((a) => (
                        <Pressable
                          key={a.id}
                          onPress={() => router.push(`/support/articulo/${a.slug}`)}
                        >
                          <HStack className="bg-card border border-border rounded-xl p-4 gap-3 items-center">
                            <VStack className="flex-1 gap-0.5">
                              <Text
                                className="text-sm font-semibold text-foreground"
                                numberOfLines={2}
                              >
                                {a.titulo}
                              </Text>
                              {a.resumen ? (
                                <Text
                                  className="text-xs text-foreground-secondary"
                                  numberOfLines={2}
                                >
                                  {a.resumen}
                                </Text>
                              ) : null}
                            </VStack>
                            <CaretRight size={16} color={palette.textTertiary} />
                          </HStack>
                        </Pressable>
                      ))}
                    </VStack>
                  )}

                  <Pressable onPress={continuarReporte}>
                    <HStack className="bg-primary rounded-xl px-5 py-4 items-center gap-3">
                      <VStack className="flex-1">
                        <Text className="text-sm font-bold text-white">
                          Ninguno aplica, reportar problema
                        </Text>
                        <Text className="text-xs text-white/80">
                          Continuamos con un caso para tu pedido.
                        </Text>
                      </VStack>
                      <CaretRight size={18} color={palette.surface} />
                    </HStack>
                  </Pressable>
                </>
              )}

              <Pressable onPress={() => setSeleccionada(null)}>
                <Text className="text-sm font-semibold text-primary text-center py-2">
                  Cambiar tipo de problema
                </Text>
              </Pressable>
            </VStack>
          ) : (
            <VStack className="gap-2">
              {CATEGORIES.map((c) => {
                const Icon = c.Icon;
                return (
                  <Pressable key={c.value} onPress={() => handleCategoriaPress(c)}>
                    <HStack className="bg-card border border-border rounded-xl p-4 gap-3 items-center">
                      <Box className="w-10 h-10 rounded-lg bg-muted items-center justify-center">
                        <Icon size={22} color={c.iconColor} weight="duotone" />
                      </Box>
                      <VStack className="flex-1 gap-0.5">
                        <Text className="text-sm font-semibold text-foreground">
                          {c.label}
                        </Text>
                        <Text className="text-xs text-foreground-secondary">
                          {c.helper}
                        </Text>
                      </VStack>
                      <CaretRight size={16} color={palette.textTertiary} />
                    </HStack>
                  </Pressable>
                );
              })}
            </VStack>
          )}
        </VStack>
      </ScrollView>
    </ScreenShell>
  );
}

function RefundFlow({
  orden,
  selectedReason,
  onSelectReason,
  onContinue,
}: {
  orden: OrderDetail;
  selectedReason: ReembolsoMotivo | null;
  onSelectReason: (reason: ReembolsoMotivo) => void;
  onContinue: () => void;
}) {
  const eligibility = orden.refund_eligibility;
  const canContinue =
    Boolean(selectedReason) &&
    (eligibility.eligible || eligibility.requires_manual_review);

  return (
    <VStack className="gap-3">
      <Box className="bg-card border border-border rounded-xl p-4">
        <HStack className="gap-3 items-start">
          <Box
            className={
              'w-10 h-10 rounded-xl items-center justify-center ' +
              (eligibility.eligible
                ? 'bg-success-soft'
                : eligibility.requires_manual_review
                  ? 'bg-warning-soft'
                  : 'bg-muted')
            }
          >
            {eligibility.eligible ? (
              <CheckCircle size={22} color={palette.success} weight="duotone" />
            ) : eligibility.requires_manual_review ? (
              <WarningCircle size={22} color={palette.warning} weight="duotone" />
            ) : (
              <XCircle size={22} color={palette.textTertiary} weight="duotone" />
            )}
          </Box>
          <VStack className="flex-1 gap-1">
            <Text className="text-sm font-bold text-foreground">
              Validación de reembolso
            </Text>
            <Text className="text-xs text-foreground-secondary">
              {REFUND_REASON_TEXT[eligibility.reason]}
            </Text>
            <HStack className="items-center justify-between mt-1">
              <Text className="text-xs text-foreground-secondary">Cargo procesado</Text>
              <Text className="text-sm font-semibold text-foreground">
                {formatPrice(eligibility.processed_amount)}
              </Text>
            </HStack>
          </VStack>
        </HStack>
      </Box>

      <VStack className="gap-2">
        <Text className="text-sm font-semibold text-foreground">
          ¿Por qué solicitas el reembolso?
        </Text>
        {REFUND_REASONS.map((reason) => {
          const selected = selectedReason === reason.value;
          return (
            <Pressable
              key={reason.value}
              onPress={() => onSelectReason(reason.value)}
              disabled={!eligibility.eligible && !eligibility.requires_manual_review}
            >
              <HStack
                className={
                  'rounded-xl border p-4 gap-3 items-start ' +
                  (selected ? 'border-primary bg-primary-soft' : 'border-border bg-card')
                }
              >
                <Box
                  className={
                    'w-5 h-5 rounded-full border-2 mt-0.5 ' +
                    (selected ? 'border-primary bg-primary' : 'border-border')
                  }
                />
                <VStack className="flex-1 gap-0.5">
                  <Text className="text-sm font-semibold text-foreground">
                    {reason.label}
                  </Text>
                  <Text className="text-xs text-foreground-secondary">
                    {reason.helper}
                  </Text>
                </VStack>
              </HStack>
            </Pressable>
          );
        })}
      </VStack>

      <Pressable onPress={onContinue} disabled={!canContinue}>
        <HStack
          className={
            'rounded-xl px-5 py-4 items-center gap-3 ' +
            (canContinue ? 'bg-primary' : 'bg-muted')
          }
        >
          <VStack className="flex-1">
            <Text
              className={
                'text-sm font-bold ' + (canContinue ? 'text-white' : 'text-foreground-secondary')
              }
            >
              {eligibility.requires_manual_review
                ? 'Enviar a revisión especializada'
                : 'Solicitar reembolso'}
            </Text>
            <Text className={canContinue ? 'text-xs text-white/80' : 'text-xs text-foreground-secondary'}>
              {canContinue
                ? 'Te pediremos una breve explicación antes de enviarlo.'
                : 'Completa la validación para continuar.'}
            </Text>
          </VStack>
          <CaretRight
            size={18}
            color={canContinue ? palette.surface : palette.textTertiary}
          />
        </HStack>
      </Pressable>

      {!eligibility.eligible && !eligibility.requires_manual_review ? (
        <Box className="bg-muted rounded-xl p-4">
          <Text className="text-xs text-foreground-secondary text-center">
            Si tu caso no encaja con esta validación, revisa las preguntas frecuentes o elige otro tipo de problema.
          </Text>
        </Box>
      ) : null}
    </VStack>
  );
}
