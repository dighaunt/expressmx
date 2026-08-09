import { Redirect, useRouter } from 'expo-router';
import { ChatCircle, Clock, MapPin, NavigationArrow, Phone, Star } from 'phosphor-react-native';
import { useState } from 'react';
import { Alert, Linking, ScrollView } from 'react-native';
import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { BottomBar } from '@/components/ui-app/bottom-bar';
import { EnRouteMap } from '@/components/ui-app/en-route-map';
import { InlineAlert } from '@/components/ui-app/inline-alert';
import { PrimaryButton } from '@/components/ui-app/primary-button';
import { ScreenHeader } from '@/components/ui-app/screen-header';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { api, ApiError } from '@/lib/api/client';
import { palette, spacing } from '@/lib/theme/tokens';
import { useJobDetail, type JobDetail } from './_layout';

type Phase =
  | 'incoming'
  | 'navigate'
  | 'redirect_active'
  | 'completed'
  | 'cancelled'
  | 'awaiting_assignment';

function mapEstatusToPhase(estatus: JobDetail['estatus']): Phase {
  if (estatus === 'asignada') return 'incoming';
  if (estatus === 'en_camino') return 'navigate';
  if (estatus === 'en_progreso') return 'redirect_active';
  if (estatus === 'completada') return 'completed';
  if (estatus === 'cancelada') return 'cancelled';
  return 'awaiting_assignment';
}

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return `${first}${last}`.toUpperCase() || '?';
}

function openMaps(latitude: number | null, longitude: number | null, address: string | null) {
  const query =
    typeof latitude === 'number' && typeof longitude === 'number'
      ? `${latitude},${longitude}`
      : address;
  if (!query) return;
  void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export default function JobDetailScreen() {
  const router = useRouter();
  const { detail, refetch } = useJobDetail();
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const phase = mapEstatusToPhase(detail.estatus);

  if (phase === 'redirect_active') {
    return <Redirect href={{ pathname: '/jobs/[id]/active', params: { id: detail.id } }} />;
  }

  async function handleAccept() {
    if (submitting) return;
    setGlobalError(null);
    setSubmitting(true);
    try {
      await api.patch(`/v1/mobile/provider/jobs/${detail.id}/status`, { estatus: 'en_camino' });
      await refetch();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'No pudimos aceptar la orden.';
      setGlobalError(message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleReject() {
    if (submitting) return;
    Alert.alert(
      'Rechazar orden',
      '¿Confirmas que rechazas esta orden? La asignaremos a otro prestador.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rechazar',
          style: 'destructive',
          onPress: async () => {
            setGlobalError(null);
            setSubmitting(true);
            try {
              await api.patch(`/v1/mobile/provider/jobs/${detail.id}/status`, {
                estatus: 'cancelada',
              });
              router.back();
            } catch (err) {
              const message =
                err instanceof ApiError ? err.message : 'No pudimos rechazar la orden.';
              setGlobalError(message);
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  }

  async function handleArrived() {
    if (submitting) return;
    setGlobalError(null);
    setSubmitting(true);
    try {
      await api.patch(`/v1/mobile/provider/jobs/${detail.id}/status`, { estatus: 'en_progreso' });
      router.replace({ pathname: '/jobs/[id]/active', params: { id: detail.id } });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'No pudimos confirmar tu llegada.';
      setGlobalError(message);
      setSubmitting(false);
    }
  }

  if (phase === 'completed' || phase === 'cancelled' || phase === 'awaiting_assignment') {
    const message =
      phase === 'completed'
        ? 'Esta orden ya fue completada.'
        : phase === 'cancelled'
          ? 'Esta orden fue cancelada.'
          : 'Esta orden aún no ha sido asignada a un prestador.';
    return (
      <ScreenShell>
        <ScreenHeader title={`Orden #${detail.id.slice(0, 8).toUpperCase()}`} />
        <Box className="flex-1 items-center justify-center px-6">
          <Text className="text-base font-semibold text-foreground text-center">{message}</Text>
          <Box className="w-full mt-6">
            <PrimaryButton onPress={() => router.replace('/(tabs)/home')}>
              Volver al inicio
            </PrimaryButton>
          </Box>
        </Box>
      </ScreenShell>
    );
  }

  const initials = getInitials(detail.cliente_nombre);
  const orderTitle = `Orden #${detail.id.slice(0, 8).toUpperCase()}`;

  if (phase === 'incoming') {
    const duracionLabel =
      isFiniteNumber(detail.servicio_duracion_min)
        ? `${(detail.servicio_duracion_min / 60).toFixed(1)} h`
        : null;
    const locationLabel = detail.direccion ?? detail.cliente_zona;
    const canOpenRoute =
      Boolean(detail.direccion) ||
      (isFiniteNumber(detail.direccion_latitud) && isFiniteNumber(detail.direccion_longitud));
    const clienteRating = isFiniteNumber(detail.cliente_rating) ? detail.cliente_rating : null;

    return (
      <ScreenShell>
        <ScreenHeader title={orderTitle} subtitle="Nueva solicitud" />
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.gutter,
            paddingTop: spacing.card,
            paddingBottom: spacing.card,
          }}
        >
          {globalError ? (
            <Box className="mb-3">
              <InlineAlert tone="danger" message={globalError} />
            </Box>
          ) : null}

          <Box className="self-start px-2.5 py-1 rounded-md bg-primary-soft">
            <Text className="text-xs font-bold text-primary-strong">NUEVA SOLICITUD</Text>
          </Box>

          <Heading className="mt-3 text-2xl font-bold text-foreground">
            {detail.servicio_nombre}
          </Heading>
          {detail.servicio_descripcion ? (
            <Text className="text-sm text-foreground-secondary mt-1" numberOfLines={2}>
              {detail.servicio_descripcion}
            </Text>
          ) : null}

          {locationLabel ? (
            <Box className="mt-4 bg-card border border-border rounded-xl p-3">
              <HStack className="items-start gap-3">
                <Box className="w-10 h-10 rounded-lg bg-muted items-center justify-center">
                  <MapPin size={19} color={palette.danger} weight="duotone" />
                </Box>
                <VStack className="flex-1">
                  <Text className="text-xs font-bold text-foreground-secondary uppercase">
                    Ubicación del servicio
                  </Text>
                  <Text className="text-sm font-semibold text-foreground mt-0.5">
                    {locationLabel}
                  </Text>
                </VStack>
                {canOpenRoute ? (
                  <Pressable
                    onPress={() =>
                      openMaps(detail.direccion_latitud, detail.direccion_longitud, detail.direccion)
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-muted"
                    accessibilityRole="button"
                  >
                    <HStack className="items-center gap-1">
                      <NavigationArrow size={14} color={palette.brandStrong} weight="fill" />
                      <Text className="text-xs font-semibold text-primary-strong">Ruta</Text>
                    </HStack>
                  </Pressable>
                ) : null}
              </HStack>
            </Box>
          ) : null}

          {duracionLabel ? (
            <HStack className="mt-4 gap-3">
              <Box className="flex-1 bg-card border border-border rounded-lg p-2.5 items-center">
                <Clock size={16} color={palette.brandStrong} />
                <Text className="text-[10px] text-foreground-secondary mt-1">Duración est.</Text>
                <Text className="text-sm font-bold text-foreground">{duracionLabel}</Text>
              </Box>
            </HStack>
          ) : null}

          <Box className="mt-4 bg-card border border-border rounded-xl p-3">
            <HStack className="items-center gap-3">
              <Box className="w-10 h-10 rounded-full bg-primary-soft items-center justify-center">
                <Text className="text-sm font-bold text-primary-strong">{initials}</Text>
              </Box>
              <VStack className="flex-1">
                <HStack className="items-center gap-2">
                  <Text className="text-sm font-bold text-foreground">
                    {detail.cliente_nombre}
                  </Text>
                  {clienteRating !== null ? (
                    <>
                      <Star size={12} color={palette.warning} weight="fill" />
                      <Text className="text-xs font-semibold text-foreground">
                        {clienteRating.toFixed(1)}
                      </Text>
                    </>
                  ) : (
                    <Text className="text-xs text-foreground-secondary">Cliente nuevo</Text>
                  )}
                </HStack>
                <Text className="text-xs text-foreground-secondary">
                  {detail.cliente_zona ?? ''}
                </Text>
              </VStack>
            </HStack>
          </Box>
        </ScrollView>
        <BottomBar>
          <HStack className="gap-3">
            <Box className="flex-1">
              <PrimaryButton variant="outline" onPress={handleReject} disabled={submitting}>
                Rechazar
              </PrimaryButton>
            </Box>
            <Box className="flex-[2]">
              <PrimaryButton onPress={handleAccept} disabled={submitting} loading={submitting}>
                Aceptar orden
              </PrimaryButton>
            </Box>
          </HStack>
        </BottomBar>
      </ScreenShell>
    );
  }

  const telefono = detail.cliente_telefono;
  const showNotas = detail.notas !== null && detail.notas.trim().length > 0;
  const navigateSubtitle = detail.aceptada_at
    ? `Aceptada ${new Date(detail.aceptada_at).toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
      })}`
    : undefined;

  return (
    <ScreenShell>
      <ScreenHeader title="En camino" subtitle={navigateSubtitle} />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.gutter,
          paddingTop: spacing.lg,
          paddingBottom: spacing.card,
        }}
      >
        {globalError ? (
          <Box className="mb-3">
            <InlineAlert tone="danger" message={globalError} />
          </Box>
        ) : null}

        <Box className="bg-card border border-border rounded-xl p-3.5">
          <HStack className="items-start gap-3">
            <Box className="w-12 h-12 rounded-full bg-primary-soft items-center justify-center">
              <Text className="text-base font-bold text-primary-strong">{initials}</Text>
            </Box>
            <VStack className="flex-1">
              <Text className="text-sm font-bold text-foreground">{detail.cliente_nombre}</Text>
              {detail.direccion ? (
                <Text className="text-xs text-foreground-secondary">{detail.direccion}</Text>
              ) : null}
              {detail.direccion_referencia ? (
                <Text className="text-xs text-foreground-secondary">
                  {detail.direccion_referencia}
                </Text>
              ) : null}
            </VStack>
            {telefono ? (
              <HStack className="gap-2">
                <Pressable
                  onPress={() => Linking.openURL(`tel:${telefono}`)}
                  className="w-10 h-10 rounded-lg bg-muted items-center justify-center"
                >
                  <Phone size={18} color={palette.brandStrong} />
                </Pressable>
                <Pressable
                  onPress={() => Linking.openURL(`sms:${telefono}`)}
                  className="w-10 h-10 rounded-lg bg-muted items-center justify-center"
                >
                  <ChatCircle size={18} color={palette.brandStrong} />
                </Pressable>
              </HStack>
            ) : null}
          </HStack>
        </Box>

        {detail.direccion ? (
          <Box className="mt-3">
            <EnRouteMap
              orderId={detail.id}
              destinationTitle="Ubicación del cliente"
              destinationAddress={detail.direccion}
              destinationLatitude={detail.direccion_latitud}
              destinationLongitude={detail.direccion_longitud}
            />
          </Box>
        ) : null}

        {showNotas ? (
          <Box className="mt-3 bg-primary-soft rounded-xl p-3.5">
            <Text className="text-xs font-bold text-primary-strong">NOTAS DEL CLIENTE</Text>
            <Text className="mt-1 text-sm text-foreground">{detail.notas}</Text>
          </Box>
        ) : null}
      </ScrollView>
      <BottomBar>
        <HStack className="gap-3">
          <Box className="flex-1">
            <PrimaryButton
              variant="outline"
              onPress={() =>
                openMaps(detail.direccion_latitud, detail.direccion_longitud, detail.direccion)
              }
              disabled={submitting}
            >
              Abrir Maps
            </PrimaryButton>
          </Box>
          <Box className="flex-[2]">
            <PrimaryButton onPress={handleArrived} disabled={submitting} loading={submitting}>
              Llegué a la dirección
            </PrimaryButton>
          </Box>
        </HStack>
      </BottomBar>
    </ScreenShell>
  );
}
