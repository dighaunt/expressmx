import { Car, MapPin } from 'phosphor-react-native';
import { useMemo } from 'react';
import { Text as RNText, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Card } from '@/components/ui/card';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { getMapRegion, mapProvider, type MapCoordinate } from '@/lib/maps';
import { palette } from '@/lib/theme/tokens';

interface ProviderLocation {
  latitude: number;
  longitude: number;
  updatedAt?: string | null;
}

interface Props {
  destinationTitle: string;
  destinationAddress?: string | null;
  destinationLatitude?: number | null;
  destinationLongitude?: number | null;
  providerLocation?: ProviderLocation | null;
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

function formatUpdatedAt(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

export function OrderTrackingMap({
  destinationTitle,
  destinationAddress,
  destinationLatitude,
  destinationLongitude,
  providerLocation,
}: Props) {
  const destination = getCoordinate(destinationLatitude, destinationLongitude);
  const provider = providerLocation
    ? getCoordinate(providerLocation.latitude, providerLocation.longitude)
    : null;

  const camera = useMemo(() => {
    const center = provider ?? destination ?? { latitude: 19.4326, longitude: -99.1332 };
    const coordinates = [provider, destination].filter(Boolean) as MapCoordinate[];
    return getMapRegion(coordinates, center ?? fallbackCenter);
  }, [provider, destination]);

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
              Aún no hay coordenadas para mostrar el seguimiento.
            </Text>
          </VStack>
        </HStack>
      </Card>
    );
  }

  const routeCoordinates = provider ? [provider, destination] : [destination];
  const updatedAt = formatUpdatedAt(providerLocation?.updatedAt);

  return (
    <Card className="overflow-hidden p-0">
      <MapView
        style={{ height: 300, width: '100%' }}
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
        {provider ? (
          <Marker coordinate={provider} anchor={{ x: 0.5, y: 0.5 }}>
            {marker('A', palette.brandStrong)}
          </Marker>
        ) : null}
        <Marker coordinate={destination} anchor={{ x: 0.5, y: 0.5 }}>
          {marker('B', palette.danger)}
        </Marker>
      </MapView>
      <VStack className="p-4 gap-2">
        <HStack className="items-center gap-2">
          <Car size={18} color={palette.brandStrong} weight="fill" />
          <Text className="text-sm font-bold text-foreground">
            {provider ? 'Prestador en camino' : 'Esperando ubicación del prestador'}
          </Text>
        </HStack>
        {destinationAddress ? (
          <Text className="text-xs text-foreground-secondary">{destinationAddress}</Text>
        ) : null}
        {updatedAt ? (
          <Text className="text-xs text-foreground-secondary">Actualizado {updatedAt}</Text>
        ) : null}
      </VStack>
    </Card>
  );
}
