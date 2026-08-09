import { useLocalSearchParams, useRouter } from 'expo-router';
import { Clock, Star, UsersThree } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { BottomBar } from '@/components/ui-app/bottom-bar';
import { PrimaryButton } from '@/components/ui-app/primary-button';
import { ScreenHeader } from '@/components/ui-app/screen-header';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { Skeleton } from '@/components/ui-app/skeleton';
import { api } from '@/lib/api/client';
import { formatPrice } from '@/lib/format';
import { palette } from '@/lib/theme/tokens';

interface ServiceDetail {
  id: string;
  nombre: string;
  descripcion: string;
  precio_base: number;
  precio_maximo: number | null;
  duracion_estimada_min: number | null;
  categoria: string;
  prestadores_count: number;
  calificacion_promedio: number | null;
}

interface ServiceDetailResponse {
  servicio: ServiceDetail;
}

export default function ServiceDetailScreen() {
  const { id, cupon, cupon_codigo } = useLocalSearchParams<{
    id: string;
    cupon?: string;
    cupon_codigo?: string;
  }>();
  const router = useRouter();
  const [servicio, setServicio] = useState<ServiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const couponCode = cupon_codigo ?? cupon;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api
      .get<ServiceDetailResponse>(`/v1/mobile/services/${id}`)
      .then((response) => {
        if (!cancelled) setServicio(response.servicio);
      })
      .catch(() => {
        if (!cancelled) setServicio(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <ScreenShell applyBottomInset={false}>
        <ScreenHeader title="Detalle del servicio" />
        <Box style={{ padding: 20 }}>
          <VStack className="gap-4">
            <Box className="bg-muted rounded-2xl p-5">
              <Skeleton width="30%" height={11} />
              <Box style={{ marginTop: 8 }}>
                <Skeleton width="55%" height={26} />
              </Box>
              <Box style={{ marginTop: 8 }}>
                <Skeleton width="80%" height={12} />
              </Box>
              <HStack className="mt-5 gap-4">
                <Skeleton width={90} height={12} />
                <Skeleton width={90} height={12} />
              </HStack>
            </Box>
            <VStack className="gap-2">
              <Skeleton width="50%" height={16} />
              <Skeleton width="95%" height={12} />
              <Skeleton width="88%" height={12} />
              <Skeleton width="70%" height={12} />
            </VStack>
            <Box className="bg-primary-soft rounded-xl p-4">
              <Skeleton width="65%" height={13} />
              <Box style={{ marginTop: 6 }}>
                <Skeleton width="90%" height={11} />
              </Box>
            </Box>
          </VStack>
        </Box>
      </ScreenShell>
    );
  }

  if (!servicio) {
    return (
      <ScreenShell applyBottomInset={false}>
        <ScreenHeader title="Detalle del servicio" />
        <Box className="flex-1 items-center justify-center px-6">
          <Text className="text-base font-semibold text-foreground text-center">
            No encontramos este servicio
          </Text>
          <Text className="text-sm text-foreground-secondary text-center mt-2">
            Puede que ya no esté disponible. Vuelve al catálogo para ver otras opciones.
          </Text>
          <Box className="w-full mt-6">
            <PrimaryButton onPress={() => router.replace('/(tabs)/services')}>
              Ver catálogo
            </PrimaryButton>
          </Box>
        </Box>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell applyBottomInset={false}>
      <ScreenHeader title={servicio.nombre} subtitle={servicio.categoria} />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <VStack className="gap-4">
          <Box className="bg-muted rounded-2xl p-5">
            <Text className="text-xs uppercase tracking-wide text-foreground-secondary">
              Tarifa base
            </Text>
            <HStack className="items-baseline gap-2 mt-1">
              <Heading className="text-2xl font-bold text-foreground">
                {formatPrice(servicio.precio_base)}
              </Heading>
              {servicio.precio_maximo && servicio.precio_maximo > servicio.precio_base ? (
                <Text className="text-sm text-foreground-secondary">
                  hasta {formatPrice(servicio.precio_maximo)}
                </Text>
              ) : null}
            </HStack>
            <Text className="text-sm text-foreground-secondary mt-1">
              Incluye visita y la primera hora de trabajo.
            </Text>

            <HStack className="mt-5 gap-4">
              <HStack className="items-center gap-1">
                <Clock size={16} color={palette.textTertiary} weight="regular" />
                <Text className="text-xs text-foreground-secondary">
                  {servicio.duracion_estimada_min
                    ? `${servicio.duracion_estimada_min} min aprox.`
                    : 'Tiempo variable'}
                </Text>
              </HStack>
              <HStack className="items-center gap-1">
                <UsersThree size={16} color={palette.textTertiary} weight="regular" />
                <Text className="text-xs text-foreground-secondary">
                  {servicio.prestadores_count} prestadores
                </Text>
              </HStack>
              {typeof servicio.calificacion_promedio === 'number' ? (
                <HStack className="items-center gap-1">
                  <Star size={16} color={palette.warning} weight="fill" />
                  <Text className="text-xs text-foreground-secondary">
                    {servicio.calificacion_promedio.toFixed(1)}
                  </Text>
                </HStack>
              ) : null}
            </HStack>
          </Box>

          <VStack className="gap-2">
            <Heading className="text-base font-bold text-foreground">Sobre este servicio</Heading>
            <Text className="text-sm text-foreground-secondary">
              {servicio.descripcion ||
                'Te asignamos a un prestador verificado de ExpressMX para que tu pendiente quede resuelto.'}
            </Text>
          </VStack>

          <Box className="bg-primary-soft rounded-xl p-4">
            <Text className="text-sm font-bold text-primary-strong">
              ExpressMX te asigna al prestador
            </Text>
            <Text className="text-xs text-foreground-secondary mt-0.5">
              Todos son empleados verificados y el pago lo recibe ExpressMX directamente.
            </Text>
          </Box>
        </VStack>
      </ScrollView>

      <BottomBar>
        <PrimaryButton
          onPress={() =>
            router.push({
              pathname: '/service-request',
              params: {
                id: servicio.id,
                nombre: servicio.nombre,
                ...(couponCode ? { cupon: couponCode } : {}),
              },
            })
          }
        >
          Solicitar este servicio
        </PrimaryButton>
      </BottomBar>
    </ScreenShell>
  );
}
