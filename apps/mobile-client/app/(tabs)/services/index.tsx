import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { MagnifyingGlass, Star, Wrench, X } from 'phosphor-react-native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet } from 'react-native';
import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField, InputSlot } from '@/components/ui/input';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { EmptyState } from '@/components/ui-app/empty-state';
import { ListRowSkeleton } from '@/components/ui-app/list-row-skeleton';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { api } from '@/lib/api/client';
import { formatPrice } from '@/lib/format';
import { palette } from '@/lib/theme/tokens';

interface ServiceItem {
  id: string;
  nombre: string;
  descripcion: string;
  precio_base: number;
  categoria: string;
  prestadores_count: number;
  calificacion_promedio: number | null;
}

interface ServicesListResponse {
  servicios: ServiceItem[];
}

export default function ServicesScreen() {
  const router = useRouter();
  const { cupon, cupon_codigo } = useLocalSearchParams<{ cupon?: string; cupon_codigo?: string }>();
  const couponCode = cupon_codigo ?? cupon;
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('todos');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await api.get<ServicesListResponse>('/v1/mobile/services');
      setServices(response.servicios);
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

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of services) set.add(s.categoria);
    return ['todos', ...Array.from(set).sort()];
  }, [services]);

  const visible = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return services.filter((s) => {
      const matchesCategory = activeCategory === 'todos' || s.categoria === activeCategory;
      if (!matchesCategory) return false;
      if (!term) return true;
      return (
        s.nombre.toLowerCase().includes(term) ||
        s.descripcion.toLowerCase().includes(term) ||
        s.categoria.toLowerCase().includes(term)
      );
    });
  }, [services, searchTerm, activeCategory]);

  return (
    <ScreenShell applyBottomInset={false}>
      <Box className="px-5 pt-2 pb-3">
        <Heading className="text-xl font-bold text-foreground">Servicios</Heading>
        <Text className="text-sm text-foreground-secondary mt-0.5">
          Elige lo que necesitas y nosotros nos encargamos.
        </Text>
      </Box>

      <Box className="px-5 pb-3">
        <Input className="h-12">
          <InputSlot>
            <MagnifyingGlass size={18} color={palette.textTertiary} />
          </InputSlot>
          <InputField
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="Buscar servicios"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchTerm ? (
            <InputSlot onPress={() => setSearchTerm('')} hitSlop={8}>
              <X size={18} color={palette.textTertiary} weight="bold" />
            </InputSlot>
          ) : null}
        </Input>
      </Box>

      <Box className="pb-3">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        >
          {categories.map((c) => {
            const isActive = c === activeCategory;
            return (
              <Pressable key={c} onPress={() => setActiveCategory(c)}>
                <Box
                  className={`px-3.5 py-2 rounded-lg ${isActive ? 'bg-primary' : 'bg-muted'}`}
                >
                  <Text
                    className={`text-sm font-semibold capitalize ${isActive ? 'text-white' : 'text-foreground'}`}
                  >
                    {c === 'todos' ? 'Todos' : c}
                  </Text>
                </Box>
              </Pressable>
            );
          })}
        </ScrollView>
      </Box>

      <FlatList
        data={loading && services.length === 0 ? [] : visible}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, flexGrow: 1 }}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        renderItem={({ item }) => (
          <ServiceRow
            service={item}
            onPress={() =>
              router.push({
                pathname: '/service-detail',
                params: { id: item.id, ...(couponCode ? { cupon: couponCode } : {}) },
              })
            }
          />
        )}
        ItemSeparatorComponent={() => <Box style={styles.separator} />}
        ListEmptyComponent={
          loading ? (
            <VStack className="gap-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <ListRowSkeleton key={`services-skeleton-${i}`} showLeading />
              ))}
            </VStack>
          ) : (
            <EmptyState
              icon={<Wrench size={28} color={palette.textTertiary} weight="duotone" />}
              title="Sin resultados"
              description="No encontramos servicios con esos filtros. Prueba con otra palabra."
            />
          )
        }
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        windowSize={7}
      />
    </ScreenShell>
  );
}

function ServiceRow({ service, onPress }: { service: ServiceItem; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <HStack className="items-center gap-3 py-3">
        <Box className="w-11 h-11 rounded-lg bg-primary-soft items-center justify-center">
          <Wrench size={20} color={palette.brandStrong} weight="duotone" />
        </Box>
        <VStack className="flex-1 gap-0.5">
          <HStack className="items-start justify-between gap-3">
            <Text className="flex-1 text-base font-semibold text-foreground" numberOfLines={1}>
              {service.nombre}
            </Text>
            <Text className="text-sm font-bold text-primary-strong" numberOfLines={1}>
              {formatPrice(service.precio_base)}
            </Text>
          </HStack>
          <Text className="text-sm text-foreground-secondary" numberOfLines={1}>
            {service.descripcion || service.categoria}
          </Text>
          <HStack className="items-center gap-3">
            <Text className="text-xs text-foreground-secondary capitalize" numberOfLines={1}>
              {service.categoria} · {service.prestadores_count} prestadores
            </Text>
            {typeof service.calificacion_promedio === 'number' ? (
              <HStack className="items-center gap-1">
                <Star size={13} color={palette.warning} weight="fill" />
                <Text className="text-xs text-foreground-secondary">
                  {service.calificacion_promedio.toFixed(1)}
                </Text>
              </HStack>
            ) : null}
          </HStack>
        </VStack>
      </HStack>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  separator: {
    borderBottomColor: palette.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginLeft: 56,
  },
});
