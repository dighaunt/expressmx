import * as Location from 'expo-location';
import { MapPin, NavigationArrow } from 'phosphor-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Text as RNText, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Card } from '@/components/ui/card';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { getMapRegion, mapProvider, type MapCoordinate } from '@/lib/maps';
import { publishOrderLocation } from '@/lib/realtime';
import { palette } from '@/lib/theme/tokens';

interface Props {
  orderId: string;
  destinationTitle: string;
  destinationAddress?: string | null;
  destinationLatitude?: number | null;
  destinationLongitude?: number | null;
  trackingEnabled?: boolean;
}

const fallbackCenter = { latitude: 19.4326, longitude: -99.1332 };

function getCoordinate(latitude?: number | null, longitude?: number | null): MapCoordinate | null {
  return typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
    ? { latitude, longitude }
    : null;
}

function marker(label: string, color: string) {
  return (
    <View
      style={{
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: color,
        borderWidth: 3,
        borderColor: palette.surface,
      }}
    >
      <RNText style={{ color: palette.surface, fontSize: 13, fontWeight: '800' }}>{label}</RNText>
    </View>
  );
}

export function EnRouteMap({
  orderId,
  destinationTitle,
  destinationAddress,
  destinationLatitude,
  destinationLongitude,
  trackingEnabled = true,
}: Props) {
  const lastPublishedAtRef = useRef(0);
  const [current, setCurrent] = useState<MapCoordinate | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const destination = getCoordinate(destinationLatitude, destinationLongitude);

  const camera = useMemo(() => {
    const center = current ?? destination ?? { latitude: 19.4326, longitude: -99.1332 };
    const coordinates = [current, destination].filter(Boolean) as MapCoordinate[];
    return getMapRegion(coordinates, center ?? fallbackCenter);
  }, [current, destination]);

  useEffect(() => {
    if (!trackingEnabled) return;
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    async function start() {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        if (!cancelled) setPermissionDenied(true);
        return;
      }

      const first = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      if (!cancelled) {
        const coordinate = {
          latitude: first.coords.latitude,
          longitude: first.coords.longitude,
        };
        setCurrent(coordinate);
        await publish(first);
      }

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10000,
          distanceInterval: 15,
        },
        (location) => {
          const coordinate = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          setCurrent(coordinate);
          publish(location).catch((err) => {
            setSyncError(err instanceof Error ? err.message : 'No pudimos compartir tu ubicación.');
          });
        },
      );
    }

    async function publish(location: Location.LocationObject) {
      const now = Date.now();
      if (now - lastPublishedAtRef.current < 8000) return;
      lastPublishedAtRef.current = now;
      await publishOrderLocation(orderId, {
        orderId,
        providerLatitude: location.coords.latitude,
        providerLongitude: location.coords.longitude,
        providerAccuracy: location.coords.accuracy ?? null,
        providerHeading: location.coords.heading ?? null,
        providerSpeed: location.coords.speed ?? null,
        providerLocationUpdatedAt: new Date(location.timestamp).toISOString(),
      });
      setSyncError(null);
    }

    start().catch((err) => {
      if (!cancelled) {
        setSyncError(err instanceof Error ? err.message : 'No pudimos iniciar el seguimiento.');
      }
    });

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [orderId, trackingEnabled]);

  if (!destination) {
    return (
      <Card className="gap-3">
        <HStack className="items-start gap-3">
          <MapPin size={22} color={palette.textTertiary} weight="duotone" />
          <VStack className="flex-1">
            <Text className="text-sm font-bold text-foreground">{destinationTitle}</Text>
            {destinationAddress ? (
              <Text className="text-xs text-foreground-secondary mt-0.5">{destinationAddress}</Text>
            ) : null}
            <Text className="text-xs text-foreground-secondary mt-2">
              Aún no hay coordenadas para trazar la ruta.
            </Text>
          </VStack>
        </HStack>
      </Card>
    );
  }

  const routeCoordinates = current ? [current, destination] : [destination];
  return (
    <Card className="overflow-hidden p-0">
      <MapView
        style={{ height: 320, width: '100%' }}
        region={camera}
        provider={mapProvider}
      >
        {routeCoordinates.length > 1 ? (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={palette.brand}
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        ) : null}
        {current ? (
          <Marker coordinate={current} anchor={{ x: 0.5, y: 0.5 }}>
            {marker('A', palette.brandStrong)}
          </Marker>
        ) : null}
        <Marker coordinate={destination} anchor={{ x: 0.5, y: 0.5 }}>
          {marker('B', palette.danger)}
        </Marker>
      </MapView>
      <VStack className="p-4 gap-2">
        <HStack className="items-center gap-2">
          <NavigationArrow size={18} color={palette.brandStrong} weight="fill" />
          <Text className="text-sm font-bold text-foreground">
            {current ? 'Ruta al cliente' : 'Destino del servicio'}
          </Text>
        </HStack>
        {destinationAddress ? (
          <Text className="text-xs text-foreground-secondary">{destinationAddress}</Text>
        ) : null}
        {permissionDenied ? (
          <Text className="text-xs text-warning">
            Activa la ubicación para ver tu punto A y compartir avance con el cliente.
          </Text>
        ) : null}
        {syncError ? <Text className="text-xs text-warning">{syncError}</Text> : null}
      </VStack>
    </Card>
  );
}
