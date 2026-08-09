import * as Linking from 'expo-linking';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Bell,
  CaretRight,
  Drop,
  Fan,
  Hammer,
  Lightning as LightningIcon,
  MagnifyingGlass,
  MapPin,
  PaintBrushHousehold,
  Plant,
  Sparkle,
  Truck,
  Wrench,
} from 'phosphor-react-native';
import type { ComponentType } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Image } from '@/components/ui/image';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { Skeleton } from '@/components/ui-app/skeleton';
import { api } from '@/lib/api/client';
import { useSession } from '@/lib/auth/use-session';
import { formatPrice } from '@/lib/format';
import { addRealtimeListener } from '@/lib/realtime';
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

interface AddressItem {
  id: string;
  alias: string | null;
  calle: string;
  numero_ext: string;
  colonia: string;
  ciudad: string;
  predeterminada: boolean;
}

interface ServicesListResponse {
  servicios: ServiceItem[];
}

interface AddressesResponse {
  data: AddressItem[];
}

interface NotificationsCountResponse {
  data: { id: string }[];
}

interface BannerItem {
  id: string;
  titulo: string;
  imagen_url: string;
  url_destino: string | null;
}

interface BannersResponse {
  data: BannerItem[];
}

const categoryIcons: Record<
  string,
  ComponentType<{ size: number; color: string; weight?: 'regular' | 'fill' | 'duotone' }>
> = {
  plomeria: Drop,
  electricidad: LightningIcon,
  limpieza: Sparkle,
  jardineria: Plant,
  pintura: PaintBrushHousehold,
  mudanza: Truck,
  cerrajeria: Hammer,
  ac: Fan,
  default: Wrench,
};

const DEFAULT_BANNER_DESTINATION = '/(tabs)/services';
const INTERNAL_BANNER_DESTINATIONS: Record<string, string> = {
  '/services': '/(tabs)/services',
  '/orders': '/(tabs)/orders',
  '/wallet': '/(tabs)/wallet',
  '/profile': '/(tabs)/profile',
  '/notifications': '/notifications',
};

function iconFor(categoria: string) {
  const key = categoria.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return categoryIcons[key as keyof typeof categoryIcons] ?? categoryIcons.default;
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useSession();
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [activeAddress, setActiveAddress] = useState<AddressItem | null>(null);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [serviciosResponse, direccionesResponse, bannersResponse] = await Promise.all([
        api.get<ServicesListResponse>('/v1/mobile/services'),
        api.get<AddressesResponse>('/v1/mobile/addresses').catch(() => ({ data: [] as AddressItem[] })),
        api.get<BannersResponse>('/v1/mobile/banners').catch(() => ({ data: [] as BannerItem[] })),
      ]);
      setServices(serviciosResponse.servicios.slice(0, 8));
      setBanners(bannersResponse.data ?? []);
      const direcciones = direccionesResponse.data ?? [];
      const predeterminada = direcciones.find((d) => d.predeterminada) ?? direcciones[0] ?? null;
      setActiveAddress(predeterminada);
      try {
        const unreadResponse = await api.get<NotificationsCountResponse>(
          '/v1/mobile/notifications?no_leidas=true&limit=1',
        );
        setUnread(unreadResponse.data?.length ?? 0);
      } catch {
        setUnread(0);
      }
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

  useEffect(() => {
    return addRealtimeListener((event) => {
      if (event.name === 'order.assigned' || event.name === 'order.status_changed') {
        void load();
      }
    });
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const greeting = greetingForNow();
  const grid = services.slice(0, 4);
  const featured = services.slice(4, 8);

  async function openBanner(banner: BannerItem) {
    const destination = resolveBannerDestination(banner.url_destino);
    if (destination.kind === 'internal') {
      router.push(destination.href as never);
      return;
    }
    await Linking.openURL(destination.href);
  }

  return (
    <ScreenShell applyBottomInset={false}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={palette.brand} />
        }
      >
        <Box className="px-5 pt-2 pb-4">
          <HStack className="justify-between items-center">
            <VStack className="flex-1">
              <Text className="text-sm text-foreground-secondary">{greeting},</Text>
              <Heading className="text-xl font-bold text-foreground" numberOfLines={1}>
                {user?.nombre ?? 'Bienvenido'}
              </Heading>
            </VStack>
            <Pressable
              onPress={() => router.push('/notifications')}
              hitSlop={10}
              className="w-11 h-11 rounded-xl bg-muted items-center justify-center"
            >
              <Bell size={22} color={palette.textPrimary} weight="regular" />
              {unread > 0 ? (
                <Box
                  className="absolute top-2 right-2 w-2 h-2 rounded-sm bg-destructive"
                />
              ) : null}
            </Pressable>
          </HStack>

          <Pressable className="mt-4" onPress={() => router.push('/(tabs)/addresses')}>
            <HStack className="items-center gap-2 bg-muted px-3.5 py-3 rounded-xl">
              <MapPin size={18} color={palette.brand} weight="fill" />
              <VStack className="flex-1">
                <Text className="text-xs text-foreground-secondary">Servicio en</Text>
                <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                  {activeAddress
                    ? `${activeAddress.alias ?? activeAddress.calle} · ${activeAddress.colonia}`
                    : 'Agrega tu primera dirección'}
                </Text>
              </VStack>
              <CaretRight size={16} color={palette.textTertiary} />
            </HStack>
          </Pressable>
        </Box>

        <Box className="px-5">
          <Pressable onPress={() => router.push('/(tabs)/services')}>
            <HStack className="items-center gap-2 bg-card border border-border px-3.5 py-3 rounded-xl">
              <MagnifyingGlass size={18} color={palette.textTertiary} />
              <Text className="text-sm text-foreground-secondary flex-1">¿Qué necesitas hoy?</Text>
            </HStack>
          </Pressable>
        </Box>

        {banners.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
            className="mt-5"
          >
            {banners.map((banner) => (
              <Pressable
                key={banner.id}
                onPress={() => void openBanner(banner)}
                className="overflow-hidden rounded-xl bg-muted"
                accessibilityRole="button"
                accessibilityLabel={`Abrir promoción ${banner.titulo}`}
                style={{ width: 300, height: 132 }}
              >
                <Image
                  source={{ uri: banner.imagen_url }}
                  resizeMode="cover"
                  accessibilityLabel={banner.titulo}
                  size="none"
                  className="h-full w-full"
                />
                <Box className="absolute left-3 top-3 right-3 rounded-lg bg-black/35 px-2.5 py-1.5">
                  <Text className="text-base font-bold text-white" numberOfLines={2}>
                    {banner.titulo}
                  </Text>
                </Box>
                <Box className="absolute bottom-3 right-3 rounded-lg bg-background/95 px-3 py-1.5">
                  <Text className="text-xs font-bold text-primary">Ver promoción</Text>
                </Box>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <Box className="px-5 mt-6 mb-2">
          <HStack className="items-center justify-between">
            <Heading className="text-base font-bold text-foreground">Empieza por aquí</Heading>
            <Pressable onPress={() => router.push('/(tabs)/services')} hitSlop={8}>
              <Text className="text-sm font-semibold text-primary">Ver todas</Text>
            </Pressable>
          </HStack>
        </Box>

        {loading && services.length === 0 ? (
          <Box className="px-5">
            <HStack className="flex-wrap justify-between" style={{ rowGap: 12 }}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <VStack
                  key={`home-cat-skeleton-${i}`}
                  className="bg-card border border-border rounded-xl p-4 gap-2"
                  style={{ width: '48%' }}
                >
                  <Skeleton width={40} height={40} radius={8} />
                  <Skeleton width="80%" height={14} />
                  <Skeleton width="55%" height={11} />
                </VStack>
              ))}
            </HStack>
          </Box>
        ) : grid.length === 0 ? (
          <Box className="mx-5 py-8 px-4 rounded-xl bg-muted">
            <Text className="text-sm text-foreground-secondary text-center">
              Pronto tendremos servicios disponibles en tu zona.
            </Text>
          </Box>
        ) : (
          <Box className="px-5">
            <HStack className="flex-wrap justify-between" style={{ rowGap: 12 }}>
              {grid.map((s) => {
                const Icon = iconFor(s.categoria);
                return (
                  <Pressable
                    key={s.id}
                    style={{ width: '48%' }}
                    onPress={() => router.push({ pathname: '/service-detail', params: { id: s.id } })}
                  >
                    <VStack className="bg-card border border-border rounded-xl p-4 gap-2">
                      <Box className="w-10 h-10 rounded-lg bg-primary-soft items-center justify-center">
                        <Icon size={22} color={palette.brand} weight="duotone" />
                      </Box>
                      <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                        {s.nombre}
                      </Text>
                      <Text className="text-xs text-foreground-secondary">
                        Desde {formatPrice(s.precio_base)}
                      </Text>
                    </VStack>
                  </Pressable>
                );
              })}
            </HStack>
          </Box>
        )}

        {featured.length > 0 ? (
          <>
            <Box className="px-5 mt-6 mb-2">
              <Heading className="text-base font-bold text-foreground">Más servicios</Heading>
              <Text className="text-sm text-foreground-secondary mt-0.5">
                Opciones útiles si todavía estás comparando.
              </Text>
            </Box>
            <VStack className="px-5 gap-2">
              {featured.map((s) => {
                const Icon = iconFor(s.categoria);
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => router.push({ pathname: '/service-detail', params: { id: s.id } })}
                  >
                    <HStack className="bg-card border border-border rounded-xl p-4 items-center gap-3">
                      <Box className="w-12 h-12 rounded-xl bg-primary-soft items-center justify-center">
                        <Icon size={24} color={palette.brand} weight="duotone" />
                      </Box>
                      <VStack className="flex-1">
                        <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                          {s.nombre}
                        </Text>
                        <Text className="text-xs text-foreground-secondary" numberOfLines={2}>
                          {s.descripcion}
                        </Text>
                      </VStack>
                      <VStack className="items-end">
                        <Text className="text-sm font-bold text-primary-strong">
                          {formatPrice(s.precio_base)}
                        </Text>
                        <Text className="text-xs text-foreground-secondary">Desde</Text>
                      </VStack>
                    </HStack>
                  </Pressable>
                );
              })}
            </VStack>
          </>
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}

function resolveBannerDestination(destination: string | null): { kind: 'internal' | 'external'; href: string } {
  const raw = destination?.trim();
  if (!raw) return { kind: 'internal', href: DEFAULT_BANNER_DESTINATION };

  if (/^https?:\/\//i.test(raw)) return { kind: 'external', href: raw };

  if (/^expressmx:\/\//i.test(raw)) {
    const path = raw.replace(/^expressmx:\/\//i, '/').replace(/^\/+/, '/');
    return { kind: 'internal', href: normalizeInternalBannerPath(path) };
  }

  if (raw.startsWith('/')) {
    return { kind: 'internal', href: normalizeInternalBannerPath(raw) };
  }

  return { kind: 'internal', href: DEFAULT_BANNER_DESTINATION };
}

function normalizeInternalBannerPath(path: string): string {
  const [pathname, query = ''] = path.split('?');
  const normalized = INTERNAL_BANNER_DESTINATIONS[pathname] ?? pathname;
  return query ? `${normalized}?${query}` : normalized;
}

function greetingForNow(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}
