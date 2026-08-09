import { MapPin } from 'phosphor-react-native';
import MapView, { Marker } from 'react-native-maps';
import { Card } from '@/components/ui/card';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { mapProvider, type MapCoordinate } from '@/lib/maps';
import { palette } from '@/lib/theme/tokens';

interface Props {
  title: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

function getCoordinates(latitude?: number | null, longitude?: number | null): MapCoordinate | null {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  )
    ? { latitude, longitude }
    : null;
}

export function LocationMap({ title, address, latitude, longitude }: Props) {
  const coordinates = getCoordinates(latitude, longitude);

  if (!coordinates) {
    return (
      <Card className="gap-3">
        <HStack className="items-start gap-3">
          <MapPin size={22} color={palette.textTertiary} weight="duotone" />
          <VStack className="flex-1">
            <Text className="text-sm font-bold text-foreground">{title}</Text>
            {address ? (
              <Text className="text-xs text-foreground-secondary mt-0.5">{address}</Text>
            ) : null}
            <Text className="text-xs text-foreground-secondary mt-2">
              Aún no hay coordenadas para mostrar el mapa.
            </Text>
          </VStack>
        </HStack>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <MapView
        style={{ height: 190, width: '100%' }}
        initialRegion={{ ...coordinates, latitudeDelta: 0.015, longitudeDelta: 0.015 }}
        provider={mapProvider}
        scrollEnabled={false}
        rotateEnabled={false}
      >
        <Marker coordinate={coordinates} anchor={{ x: 0.5, y: 0.5 }}>
          <MapPin size={30} color={palette.danger} weight="fill" />
        </Marker>
      </MapView>
      <VStack className="p-4">
        <Text className="text-sm font-bold text-foreground">{title}</Text>
        {address ? (
          <Text className="text-xs text-foreground-secondary mt-0.5">{address}</Text>
        ) : null}
      </VStack>
    </Card>
  );
}
