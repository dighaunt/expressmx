import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  CalendarBlank,
  ChatCircleDots,
  Check,
  CurrencyCircleDollar,
  Key,
  Lock,
  MapPin,
  Phone,
  Receipt,
  UserCircle,
  Warning,
} from 'phosphor-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView } from 'react-native';
import { Box } from '@/components/ui/box';
import { Divider } from '@/components/ui/divider';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { FormField } from '@/components/ui-app/form-field';
import { HeaderSkeleton } from '@/components/ui-app/header-skeleton';
import { InlineAlert } from '@/components/ui-app/inline-alert';
import { OrderTrackingMap } from '@/components/ui-app/order-tracking-map';
import { PrimaryButton } from '@/components/ui-app/primary-button';
import { ScreenHeader } from '@/components/ui-app/screen-header';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { Skeleton } from '@/components/ui-app/skeleton';
import { StatusBadge } from '@/components/ui-app/status-badge';
import { api, ApiError } from '@/lib/api/client';
import { formatDateTime, formatPrice } from '@/lib/format';
import { addRealtimeListener, subscribeOrderRealtime, type RealtimeEvent } from '@/lib/realtime';
import { estatusOrden, palette, type EstatusOrden } from '@/lib/theme/tokens';

interface CargoExtra {
  id: string;
  descripcion: string;
  monto: number;
  estatus: 'propuesto' | 'aceptado' | 'rechazado';
}

interface OrderDetail {
  id: string;
  estatus: EstatusOrden;
  fecha_creacion: string;
  fecha_programada: string | null;
  total: number;
  servicio_nombre: string;
  prestador_nombre: string | null;
  prestador_telefono: string | null;
  direccion: string | null;
  direccion_latitud: number | null;
  direccion_longitud: number | null;
  pin_cliente?: string | null;
  pin_prestador_confirmado?: boolean;
  pago_pendiente?: boolean;
  cargos_extra?: CargoExtra[];
}

interface OrderDetailResponse {
  orden: OrderDetail;
}

interface ProviderLocation {
  latitude: number;
  longitude: number;
  updatedAt?: string | null;
}

const showPinStates: EstatusOrden[] = ['asignada', 'en_camino', 'en_progreso'];
const locationRealtimeStates: EstatusOrden[] = ['asignada', 'en_camino', 'en_progreso'];

const trackingSteps: { key: EstatusOrden; label: string; description: string }[] = [
  { key: 'solicitada', label: 'Solicitud recibida', description: 'Estamos validando tu pedido.' },
  { key: 'asignada', label: 'Prestador asignado', description: 'ExpressMX confirmó al prestador adecuado.' },
  { key: 'en_camino', label: 'En camino', description: 'Tu prestador va para allá.' },
  { key: 'en_progreso', label: 'En servicio', description: 'El trabajo está en proceso.' },
  { key: 'completada', label: 'Completado', description: 'Listo, gracias por usar ExpressMX.' },
];

function getProviderLocationFromEvent(event: RealtimeEvent): ProviderLocation | null {
  const latitude = event.data.providerLatitude;
  const longitude = event.data.providerLongitude;
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }
  return {
    latitude,
    longitude,
    updatedAt: event.data.providerLocationUpdatedAt ?? null,
  };
}

export default function OrderTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [orden, setOrden] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [extras, setExtras] = useState<CargoExtra[]>([]);
  const [pinPrestadorInput, setPinPrestadorInput] = useState('');
  const [pinPrestadorSubmitting, setPinPrestadorSubmitting] = useState(false);
  const [pinPrestadorError, setPinPrestadorError] = useState<string | null>(null);
  const [providerLocation, setProviderLocation] = useState<ProviderLocation | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    api
      .get<OrderDetailResponse>(`/v1/mobile/orders/${id}`)
      .then((response) => {
        if (!cancelled) {
          setOrden(response.orden);
          setExtras(response.orden.cargos_extra ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => load(), [load]);

  useEffect(() => {
    return addRealtimeListener((event) => {
      if (
        (event.name === 'order.assigned' || event.name === 'order.status_changed') &&
        event.data.orderId === id
      ) {
        load();
      }
    });
  }, [id, load]);

  const ordenEstatus = orden?.estatus;

  useEffect(() => {
    if (!id || !ordenEstatus || !locationRealtimeStates.includes(ordenEstatus)) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    subscribeOrderRealtime(id, (event) => {
      if (event.name !== 'order.provider_location' || event.data.orderId !== id) return;
      const location = getProviderLocationFromEvent(event);
      if (location) setProviderLocation(location);
    })
      .then((nextCleanup) => {
        if (cancelled) {
          nextCleanup();
        } else {
          cleanup = nextCleanup;
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [id, ordenEstatus]);

  function resolveExtra(extraId: string, estatus: 'aceptado' | 'rechazado') {
    setExtras((prev) => prev.map((e) => (e.id === extraId ? { ...e, estatus } : e)));
  }

  async function confirmPinPrestador() {
    if (!id) return;
    setPinPrestadorError(null);
    if (!/^[0-9]{6}$/.test(pinPrestadorInput)) {
      setPinPrestadorError('Pídele al prestador su código de 6 dígitos.');
      return;
    }
    setPinPrestadorSubmitting(true);
    try {
      await api.post(`/v1/mobile/orders/${id}/pin-prestador`, { pin: pinPrestadorInput });
      setPinPrestadorInput('');
      const response = await api.get<OrderDetailResponse>(`/v1/mobile/orders/${id}`);
      setOrden(response.orden);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'No pudimos confirmar el código. Inténtalo de nuevo.';
      setPinPrestadorError(message);
    } finally {
      setPinPrestadorSubmitting(false);
    }
  }

  if (loading) {
    return (
      <ScreenShell>
        <ScreenHeader title="Seguimiento" />
        <Box style={{ padding: 20 }}>
          <VStack className="gap-4">
            <HStack className="items-center justify-between">
              <Skeleton width={90} height={22} radius={11} />
              <Skeleton width={80} height={16} />
            </HStack>
            <HeaderSkeleton withAvatar />
            <VStack className="bg-card border border-border rounded-xl p-4 gap-3">
              <Skeleton width="40%" height={13} />
              <Skeleton width="85%" height={12} />
              <Skeleton width="75%" height={12} />
              <Skeleton width="80%" height={12} />
            </VStack>
            <VStack className="bg-card border border-border rounded-xl p-4 gap-3">
              <Skeleton width="50%" height={13} />
              <Skeleton width="90%" height={12} />
              <Skeleton width="70%" height={12} />
            </VStack>
          </VStack>
        </Box>
      </ScreenShell>
    );
  }

  if (missing || !orden) {
    return (
      <ScreenShell>
        <ScreenHeader title="Seguimiento" />
        <Box className="flex-1 items-center justify-center px-6">
          <Receipt size={32} color={palette.textTertiary} weight="duotone" />
          <Text className="mt-3 text-base font-semibold text-foreground text-center">
            No encontramos este pedido
          </Text>
          <Text className="mt-1 text-sm text-foreground-secondary text-center">
            Puede que se haya cancelado. Vuelve al listado para ver tus pedidos.
          </Text>
          <Box className="w-full mt-6">
            <PrimaryButton onPress={() => router.replace('/(tabs)/orders')}>
              Ver mis pedidos
            </PrimaryButton>
          </Box>
        </Box>
      </ScreenShell>
    );
  }

  const isCancelled = orden.estatus === 'cancelada';
  const status = estatusOrden[orden.estatus];
  const activeIndex = trackingSteps.findIndex((s) => s.key === orden.estatus);
  const showPin = showPinStates.includes(orden.estatus) && Boolean(orden.pin_cliente);
  const showPinCierre =
    orden.estatus === 'en_progreso' && orden.pin_prestador_confirmado === false;
  const pendingExtras = extras.filter((e) => e.estatus === 'propuesto');
  const acceptedExtras = extras.filter((e) => e.estatus === 'aceptado');
  const acceptedExtrasTotal = acceptedExtras.reduce((acc, e) => acc + e.monto, 0);
  const showPaymentCta = orden.estatus === 'completada' && orden.pago_pendiente !== false;
  const canReport = orden.estatus !== 'cancelada' && orden.estatus !== 'solicitada';
  const reportProminent = orden.estatus === 'completada';

  return (
    <ScreenShell>
      <ScreenHeader
        title={orden.servicio_nombre}
        subtitle={`Pedido #${orden.id.slice(0, 8).toUpperCase()}`}
      />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <VStack className="gap-4">
          <HStack className="items-center justify-between">
            <StatusBadge label={status.label} tone={status.tone} />
            <Text className="text-sm font-bold text-foreground">{formatPrice(orden.total)}</Text>
          </HStack>

          {showPin ? (
            <Box className="bg-primary-soft rounded-2xl p-4">
              <HStack className="items-center gap-3">
                <Box className="w-11 h-11 rounded-lg bg-card items-center justify-center">
                  <Lock size={20} color={palette.brandStrong} weight="fill" />
                </Box>
                <VStack className="flex-1">
                  <Text className="text-xs font-bold text-primary-strong uppercase tracking-wide">
                    Tu PIN para iniciar
                  </Text>
                  <Text className="text-xs text-foreground-secondary">
                    Compártelo con el prestador al llegar
                  </Text>
                </VStack>
                <Heading className="text-2xl font-bold text-primary tracking-widest">
                  {orden.pin_cliente}
                </Heading>
              </HStack>
            </Box>
          ) : null}

          {showPinCierre ? (
            <Box className="bg-card border border-primary-soft rounded-2xl p-4">
              <HStack className="items-center gap-3 mb-3">
                <Box className="w-11 h-11 rounded-lg bg-primary-soft items-center justify-center">
                  <Key size={20} color={palette.brandStrong} weight="fill" />
                </Box>
                <VStack className="flex-1">
                  <Text className="text-sm font-bold text-foreground">PIN para cerrar</Text>
                  <Text className="text-xs text-foreground-secondary">
                    Pídele al prestador su código de cierre y tecléalo aquí.
                  </Text>
                </VStack>
              </HStack>
              {pinPrestadorError ? (
                <Box className="mb-3">
                  <InlineAlert tone="danger" message={pinPrestadorError} />
                </Box>
              ) : null}
              <FormField
                label="Código del prestador"
                value={pinPrestadorInput}
                onChangeText={(v) =>
                  setPinPrestadorInput(v.replace(/[^0-9]/g, '').slice(0, 6))
                }
                placeholder="123456"
                type="numeric"
                maxLength={6}
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                returnKeyType="go"
                onSubmitEditing={confirmPinPrestador}
              />
              <Box className="mt-3">
                <PrimaryButton
                  onPress={confirmPinPrestador}
                  loading={pinPrestadorSubmitting}
                  disabled={pinPrestadorSubmitting}
                >
                  {pinPrestadorSubmitting ? 'Confirmando…' : 'Confirmar cierre'}
                </PrimaryButton>
              </Box>
            </Box>
          ) : null}

          {pendingExtras.length > 0 ? (
            <VStack className="gap-2">
              <HStack className="items-center justify-between">
                <Heading className="text-base font-bold text-foreground">
                  Sobrecostos por aprobar
                </Heading>
                <Text className="text-xs text-foreground-secondary">
                  {pendingExtras.length} pendiente{pendingExtras.length === 1 ? '' : 's'}
                </Text>
              </HStack>
              {pendingExtras.map((extra) => (
                <Box key={extra.id} className="bg-card border border-warning rounded-xl p-4">
                  <HStack className="items-start gap-3">
                    <Box className="w-10 h-10 rounded-lg bg-warning-soft items-center justify-center">
                      <CurrencyCircleDollar size={20} color={palette.warning} weight="fill" />
                    </Box>
                    <VStack className="flex-1">
                      <Text className="text-sm font-bold text-foreground">{extra.descripcion}</Text>
                      <Text className="text-xs text-foreground-secondary">
                        Propuesto por el prestador
                      </Text>
                    </VStack>
                    <Text className="text-base font-bold text-foreground">
                      {formatPrice(extra.monto, true)}
                    </Text>
                  </HStack>
                  <HStack className="gap-2 mt-3">
                    <Box className="flex-1">
                      <PrimaryButton
                        size="sm"
                        variant="outline"
                        onPress={() => resolveExtra(extra.id, 'rechazado')}
                      >
                        Rechazar
                      </PrimaryButton>
                    </Box>
                    <Box className="flex-1">
                      <PrimaryButton
                        size="sm"
                        onPress={() => resolveExtra(extra.id, 'aceptado')}
                      >
                        Autorizar
                      </PrimaryButton>
                    </Box>
                  </HStack>
                </Box>
              ))}
            </VStack>
          ) : null}

          {acceptedExtras.length > 0 ? (
            <Box className="bg-success-soft rounded-xl p-3">
              <HStack className="items-center gap-2">
                <Check size={16} color={palette.success} weight="bold" />
                <Text className="text-sm font-semibold text-success flex-1">
                  Sobrecostos autorizados
                </Text>
                <Text className="text-sm font-bold text-success">
                  +{formatPrice(acceptedExtrasTotal, true)}
                </Text>
              </HStack>
            </Box>
          ) : null}

          {isCancelled ? (
            <InlineAlert
              tone="danger"
              title="Pedido cancelado"
              message="Este servicio fue cancelado. Si necesitas ayuda, escríbele al equipo de soporte."
            />
          ) : (
            <VStack className="bg-card border border-border rounded-xl p-4 gap-3">
              <Heading className="text-sm font-bold text-foreground">Estado del pedido</Heading>
              <VStack className="gap-3">
                {trackingSteps.map((step, index) => {
                  const done = index < activeIndex;
                  const active = index === activeIndex;
                  const fgClass =
                    done || active ? 'text-foreground' : 'text-foreground-secondary';
                  return (
                    <HStack key={step.key} className="gap-3 items-start">
                      <VStack className="items-center" style={{ width: 28 }}>
                        <Box
                          className={`w-6 h-6 rounded items-center justify-center ${done ? 'bg-primary' : active ? 'bg-primary-soft border-2 border-primary' : 'bg-muted'}`}
                        >
                          {done ? <Check size={14} color={palette.surface} weight="bold" /> : null}
                          {active ? (
                            <Box className="w-2 h-2 rounded-sm bg-primary" />
                          ) : null}
                        </Box>
                        {index < trackingSteps.length - 1 ? (
                          <Box
                            className={`mt-1 ${done ? 'bg-primary' : 'bg-border'}`}
                            style={{ width: 2, height: 32, borderRadius: 1 }}
                          />
                        ) : null}
                      </VStack>
                      <VStack className="flex-1 pb-2">
                        <Text
                          className={`text-sm ${active ? 'font-bold' : 'font-semibold'} ${fgClass}`}
                        >
                          {step.label}
                        </Text>
                        <Text className="text-xs text-foreground-secondary">
                          {step.description}
                        </Text>
                      </VStack>
                    </HStack>
                  );
                })}
              </VStack>
            </VStack>
          )}

          <VStack className="bg-card border border-border rounded-xl overflow-hidden">
            <HStack className="p-4 gap-3 items-center">
              <Box className="w-11 h-11 rounded-lg bg-primary-soft items-center justify-center">
                <UserCircle size={24} color={palette.brand} weight="duotone" />
              </Box>
              <VStack className="flex-1">
                <Text className="text-xs text-foreground-secondary">Prestador</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {orden.prestador_nombre ?? 'Lo asignaremos en breve'}
                </Text>
                {orden.prestador_telefono ? (
                  <Text className="text-xs text-foreground-secondary mt-0.5">
                    Tel. {orden.prestador_telefono}
                  </Text>
                ) : null}
              </VStack>
              {orden.prestador_telefono ? (
                <Pressable
                  onPress={() => Linking.openURL(`tel:${orden.prestador_telefono}`)}
                  className="w-10 h-10 rounded-lg bg-primary-soft items-center justify-center"
                >
                  <Phone size={18} color={palette.brand} weight="fill" />
                </Pressable>
              ) : null}
            </HStack>
            <Divider />
            <HStack className="p-4 gap-3 items-center">
              <Box className="w-11 h-11 rounded-lg bg-muted items-center justify-center">
                <CalendarBlank size={22} color={palette.textPrimary} />
              </Box>
              <VStack className="flex-1">
                <Text className="text-xs text-foreground-secondary">Programado para</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {orden.fecha_programada
                    ? formatDateTime(orden.fecha_programada)
                    : 'En cuanto sea posible'}
                </Text>
              </VStack>
            </HStack>
            {orden.direccion ? (
              <>
                <Divider />
                <HStack className="p-4 gap-3 items-start">
                  <Box className="w-11 h-11 rounded-lg bg-muted items-center justify-center">
                    <MapPin size={22} color={palette.textPrimary} />
                  </Box>
                  <VStack className="flex-1">
                    <Text className="text-xs text-foreground-secondary">Dirección</Text>
                    <Text className="text-sm font-semibold text-foreground">{orden.direccion}</Text>
                  </VStack>
                </HStack>
              </>
            ) : null}
          </VStack>

          {orden.direccion ? (
            <OrderTrackingMap
              destinationTitle="Ubicación del servicio"
              destinationAddress={orden.direccion}
              destinationLatitude={orden.direccion_latitud}
              destinationLongitude={orden.direccion_longitud}
              providerLocation={providerLocation}
            />
          ) : null}

          {showPaymentCta ? (
            <VStack className="gap-2">
              <PrimaryButton
                onPress={() => router.push({ pathname: '/payment', params: { id: orden.id } })}
              >
                Pagar a ExpressMX
              </PrimaryButton>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/orders/[id]/reportar-problema',
                    params: { id: orden.id, categoria: 'cobro_incorrecto' },
                  })
                }
                hitSlop={6}
              >
                <Text className="text-xs text-foreground-secondary text-center">
                  ¿Hubo un problema con el cobro?{' '}
                  <Text className="text-xs font-bold text-primary">Reportar</Text>
                </Text>
              </Pressable>
            </VStack>
          ) : null}

          {orden.estatus === 'completada' && !showPaymentCta ? (
            <PrimaryButton
              onPress={() => router.push({ pathname: '/order-rating', params: { id: orden.id } })}
            >
              Calificar este servicio
            </PrimaryButton>
          ) : null}

          {canReport ? (
            reportProminent ? (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/orders/[id]/reportar-problema',
                    params: { id: orden.id },
                  })
                }
              >
                <HStack className="bg-card border border-border rounded-xl p-4 items-center gap-3">
                  <Box className="w-10 h-10 rounded-lg bg-warning-soft items-center justify-center">
                    <Warning size={20} color={palette.warning} weight="fill" />
                  </Box>
                  <VStack className="flex-1">
                    <Text className="text-sm font-bold text-foreground">Reportar problema</Text>
                    <Text className="text-xs text-foreground-secondary">
                      Cobro incorrecto, daño, queja o cualquier otro tema.
                    </Text>
                  </VStack>
                </HStack>
              </Pressable>
            ) : (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/orders/[id]/reportar-problema',
                    params: { id: orden.id },
                  })
                }
              >
                <HStack className="bg-muted border border-border rounded-xl p-3.5 items-center gap-3 justify-center">
                  <ChatCircleDots size={18} color={palette.textSecondary} weight="regular" />
                  <Text className="text-sm font-semibold text-foreground-secondary">
                    Reportar problema
                  </Text>
                </HStack>
              </Pressable>
            )
          ) : null}
        </VStack>
      </ScrollView>
    </ScreenShell>
  );
}
