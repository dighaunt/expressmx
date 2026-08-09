import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { House, MapPin, Plus, Star } from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { BottomBar } from '@/components/ui-app/bottom-bar';
import { EmptyState } from '@/components/ui-app/empty-state';
import { ListRowSkeleton } from '@/components/ui-app/list-row-skeleton';
import { PrimaryButton } from '@/components/ui-app/primary-button';
import { ScreenHeader } from '@/components/ui-app/screen-header';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { api } from '@/lib/api/client';
import { palette } from '@/lib/theme/tokens';

interface AddressItem {
  id: string;
  alias: string | null;
  calle: string;
  numero_ext: string;
  numero_int: string | null;
  colonia: string;
  cp: string;
  ciudad: string;
  estado: string;
  referencia: string | null;
  predeterminada: boolean;
}

interface AddressesResponse {
  data: AddressItem[];
}

export default function AddressesScreen() {
  const router = useRouter();
  const { select, returnTo, id, nombre, cupon } = useLocalSearchParams<{
    select?: string;
    returnTo?: string;
    id?: string;
    nombre?: string;
    cupon?: string;
  }>();
  const [items, setItems] = useState<AddressItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const selectionMode = select === '1';

  const load = useCallback(async () => {
    try {
      const response = await api.get<AddressesResponse>('/v1/mobile/addresses');
      setItems(response.data ?? []);
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

  async function handlePressAddress(item: AddressItem) {
    if (!selectionMode) {
      router.push({ pathname: '/(tabs)/addresses/edit', params: { id: item.id } });
      return;
    }
    setSelectingId(item.id);
    try {
      await api.patch(`/v1/mobile/addresses/${item.id}`, { predeterminada: true });
      router.replace({
        pathname: returnTo ?? '/(tabs)/service-request',
        params: {
          id,
          nombre,
          cupon,
        },
      });
    } finally {
      setSelectingId(null);
    }
  }

  return (
    <ScreenShell applyBottomInset={false}>
      <ScreenHeader
        title={selectionMode ? 'Elegir dirección' : 'Mis direcciones'}
        subtitle={
          selectionMode
            ? 'Selecciona dónde quieres recibir el servicio.'
            : 'Donde quieres recibir nuestros servicios.'
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={palette.brand} />
        }
      >
        {loading && items.length === 0 ? (
          <VStack className="gap-2">
            <ListRowSkeleton showLeading />
            <ListRowSkeleton showLeading />
            <ListRowSkeleton showLeading />
            <ListRowSkeleton showLeading />
          </VStack>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<House size={28} color={palette.brand} weight="duotone" />}
            title="Aún no tienes direcciones"
            description="Agrega la primera para que podamos enviarte un prestador."
            cta={{
              label: 'Agregar mi primera dirección',
              onPress: () => router.push('/(tabs)/addresses/new'),
            }}
          />
        ) : (
          <VStack className="gap-2">
            {items.map((item) => (
              <Pressable key={item.id} onPress={() => handlePressAddress(item)} disabled={selectingId === item.id}>
                <VStack
                  className="bg-card rounded-xl p-4 gap-2 border border-border"
                >
                  <HStack className="items-center justify-between">
                    <HStack className="items-center gap-2">
                      <Box className={`w-9 h-9 rounded-lg items-center justify-center ${item.predeterminada ? 'bg-primary-soft' : 'bg-muted'}`}>
                        <MapPin size={18} color={item.predeterminada ? palette.brand : palette.textTertiary} weight="fill" />
                      </Box>
                      <Text className="text-base font-bold text-foreground">
                        {item.alias ?? `${item.calle} ${item.numero_ext}`}
                      </Text>
                    </HStack>
                    {selectionMode ? (
                      <Text className="text-xs font-bold text-primary">
                        {selectingId === item.id ? 'Seleccionando...' : 'Elegir'}
                      </Text>
                    ) : item.predeterminada ? (
                      <HStack className="items-center gap-1">
                        <Star size={14} color={palette.brand} weight="fill" />
                        <Text className="text-xs font-bold text-primary">Predeterminada</Text>
                      </HStack>
                    ) : null}
                  </HStack>
                  <Text className="text-sm text-foreground">
                    {item.calle} {item.numero_ext}
                    {item.numero_int ? ` interior ${item.numero_int}` : ''}
                  </Text>
                  <Text className="text-xs text-foreground-secondary">
                    {item.colonia}, {item.ciudad}, {item.estado} · CP {item.cp}
                  </Text>
                  {item.referencia ? (
                    <Text className="text-xs text-foreground-secondary" numberOfLines={2}>
                      Ref. {item.referencia}
                    </Text>
                  ) : null}
                </VStack>
              </Pressable>
            ))}
          </VStack>
        )}
      </ScrollView>

      {items.length > 0 ? (
        <BottomBar>
          <PrimaryButton onPress={() => router.push('/(tabs)/addresses/new')}>
            <HStack className="items-center gap-1">
              <Plus size={18} color={palette.surface} weight="bold" />
              <Text className="text-white font-semibold">Agregar dirección</Text>
            </HStack>
          </PrimaryButton>
        </BottomBar>
      ) : null}
    </ScreenShell>
  );
}
