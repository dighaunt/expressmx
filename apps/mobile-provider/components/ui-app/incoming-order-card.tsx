import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Linking } from 'react-native';
import * as Location from 'expo-location';
import { Clock, MapPin, NavigationArrow, Wrench } from 'phosphor-react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { getMapRegion, mapProvider } from '@/lib/maps';
import { formatMxn, palette } from '@/lib/theme/tokens';

export interface IncomingOrderPreview {
  id: string;
  serviceName: string;
  scheduledAt?: string | null;
  address?: string | null;
  zone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  total?: number | null;
}

interface Props {
  order: IncomingOrderPreview | null;
  onView: () => void;
  onRoute: () => void;
}

type Coordinates = { latitude: number; longitude: number };

function getCoordinates(latitude?: number | null, longitude?: number | null) {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  )
    ? { latitude, longitude }
    : null;
}

function getRouteCamera(destination: Coordinates, origin: Coordinates | null) {
  return getMapRegion([origin, destination].filter(Boolean) as Coordinates[], destination);
}

async function getProviderCoordinates(): Promise<Coordinates | null> {
  const current = await Location.getForegroundPermissionsAsync();
  const permission =
    current.status === Location.PermissionStatus.GRANTED
      ? current
      : await Location.requestForegroundPermissionsAsync();
  if (permission.status !== Location.PermissionStatus.GRANTED) return null;

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}

function formatDate(value?: string | null): string {
  if (!value) return 'Horario por confirmar';
  return new Date(value).toLocaleString('es-MX', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function openRoute(order: IncomingOrderPreview) {
  const coordinates = getCoordinates(order.latitude, order.longitude);
  const destination = coordinates
    ? `${coordinates.latitude},${coordinates.longitude}`
    : order.address;
  if (!destination) return;
  const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
  Linking.openURL(url).catch(() => null);
}

export function IncomingOrderCard({ order, onView, onRoute }: Props) {
  const insets = useSafeAreaInsets();
  const pulse = useRef(new Animated.Value(0)).current;
  const [providerCoordinates, setProviderCoordinates] = useState<Coordinates | null>(null);

  useEffect(() => {
    if (!order) return;
    pulse.setValue(0);
    const animation = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [order, pulse]);

  useEffect(() => {
    let cancelled = false;
    setProviderCoordinates(null);
    if (!order || !getCoordinates(order.latitude, order.longitude)) return;

    getProviderCoordinates()
      .then((coordinates) => {
        if (!cancelled) setProviderCoordinates(coordinates);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [order]);

  if (!order) return null;

  const coordinates = getCoordinates(order.latitude, order.longitude);
  const camera = coordinates ? getRouteCamera(coordinates, providerCoordinates) : null;
  const pulseOpacity = pulse.interpolate({
    inputRange: [0, 0.75, 1],
    outputRange: [0.42, 0.1, 0],
  });
  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.82, 1.75],
  });

  return (
    <Box
      pointerEvents="box-none"
      className="absolute left-0 right-0 z-50 px-4"
      style={{ top: insets.top + 10 }}
    >
      <Card className="overflow-hidden p-0 border-border bg-card">
        {coordinates && camera ? (
          <MapView
            style={{ height: 138, width: '100%' }}
            region={camera}
            provider={mapProvider}
            scrollEnabled={false}
            rotateEnabled={false}
          >
            {providerCoordinates ? (
              <>
                <Polyline
                  coordinates={[providerCoordinates, coordinates]}
                  strokeColor={palette.brand}
                  strokeWidth={3}
                  lineDashPattern={[2, 2]}
                />
                <Marker coordinate={providerCoordinates} anchor={{ x: 0.5, y: 0.5 }}>
                  <MapPin size={26} color={palette.brandStrong} weight="fill" />
                </Marker>
              </>
            ) : null}
            <Marker coordinate={coordinates} anchor={{ x: 0.5, y: 0.5 }}>
              <MapPin size={28} color={palette.danger} weight="fill" />
            </Marker>
          </MapView>
        ) : null}

        <VStack className="p-3.5 gap-3">
          <HStack className="items-start gap-3">
            <Box className="w-11 h-11 items-center justify-center">
              <Animated.View
                style={{
                  position: 'absolute',
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: palette.brand,
                  opacity: pulseOpacity,
                  transform: [{ scale: pulseScale }],
                }}
              />
              <Box className="w-10 h-10 rounded-lg bg-primary-soft items-center justify-center">
                <Wrench size={20} color={palette.brandStrong} weight="duotone" />
              </Box>
            </Box>
            <VStack className="flex-1 gap-1">
              <HStack className="items-center gap-2">
                <Badge tone="brand">
                  <BadgeText>Nueva solicitud</BadgeText>
                </Badge>
              </HStack>
              <Text className="text-base font-bold text-foreground" numberOfLines={1}>
                {order.serviceName}
              </Text>
              <Text className="text-xs text-foreground-secondary">
                #{order.id.slice(0, 8).toUpperCase()}
                {order.total ? ` · ${formatMxn(order.total)}` : ''}
              </Text>
            </VStack>
          </HStack>

          <VStack className="gap-2">
            <HStack className="items-start gap-2">
              <Clock size={16} color={palette.textTertiary} />
              <Text className="flex-1 text-sm text-foreground-secondary">
                {formatDate(order.scheduledAt)}
              </Text>
            </HStack>
            <HStack className="items-start gap-2">
              <MapPin size={16} color={palette.textTertiary} />
              <Text className="flex-1 text-sm text-foreground" numberOfLines={2}>
                {order.address ?? order.zone ?? 'Ubicación pendiente'}
              </Text>
            </HStack>
          </VStack>

          <HStack className="gap-2">
            <Button
              className="flex-1 h-11"
              variant="outline"
              onPress={() => {
                onRoute();
                openRoute(order);
              }}
              disabled={!order.address && !coordinates}
            >
              <NavigationArrow size={16} color={palette.textPrimary} weight="fill" />
              <ButtonText>Ruta</ButtonText>
            </Button>
            <Button className="flex-1 h-11" onPress={onView}>
              <ButtonText>Ver pedido</ButtonText>
            </Button>
          </HStack>
        </VStack>
      </Card>
    </Box>
  );
}
