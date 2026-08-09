import { useFocusEffect, useRouter } from 'expo-router';
import {
  CaretRight,
  ChatCircleDots,
  EnvelopeSimple,
  MagnifyingGlass,
  Phone,
  Receipt,
  Ticket as TicketIcon,
} from 'phosphor-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, RefreshControl, ScrollView } from 'react-native';
import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField, InputSlot } from '@/components/ui/input';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { EmptyState } from '@/components/ui-app/empty-state';
import { ListRowSkeleton } from '@/components/ui-app/list-row-skeleton';
import { ScreenHeader } from '@/components/ui-app/screen-header';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { StatusBadge } from '@/components/ui-app/status-badge';
import { SupportPinSection } from '@/components/ui-app/support-pin-section';
import { WalletCard } from '@/components/ui-app/wallet-card';
import { WalletStack, type WalletStackItem } from '@/components/ui-app/wallet-stack';
import { api } from '@/lib/api/client';
import { formatDateLong } from '@/lib/format';
import { bucketByAge, palette, type Tone } from '@/lib/theme/tokens';

interface TicketItem {
  id: string;
  asunto: string;
  estatus: 'abierto' | 'en_revision' | 'resuelto' | 'escalado';
  categoria: string;
  created_at: string;
}

interface ArticuloItem {
  id: string;
  slug: string;
  titulo: string;
  resumen: string | null;
  categoria: string;
  view_count: number;
  helpful_count: number;
}

interface TicketsResponse {
  data: TicketItem[];
}

interface ArticulosResponse {
  data: ArticuloItem[];
}

interface ContactosResponse {
  data: {
    telefono: string | null;
    whatsapp: string | null;
    email: string | null;
  };
}

const ticketStatusLabel: Record<TicketItem['estatus'], { label: string; tone: Tone }> = {
  abierto: { label: 'Abierto', tone: 'info' },
  en_revision: { label: 'En revisión', tone: 'warning' },
  resuelto: { label: 'Resuelto', tone: 'success' },
  escalado: { label: 'Escalado', tone: 'danger' },
};

const ACTIVE_STATUSES = new Set(['abierto', 'en_revision', 'escalado']);

function buildWhatsappUrl(numero: string): string {
  const digits = numero.replace(/[^0-9]/g, '');
  return `https://wa.me/${digits}`;
}

export default function SupportScreen() {
  const router = useRouter();

  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [contactos, setContactos] = useState<ContactosResponse['data'] | null>(null);
  const [contactosLoading, setContactosLoading] = useState(true);

  const [topArticulos, setTopArticulos] = useState<ArticuloItem[]>([]);
  const [articulosLoading, setArticulosLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ArticuloItem[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadTickets = useCallback(async () => {
    try {
      const response = await api.get<TicketsResponse>('/v1/mobile/tickets');
      setTickets(response.data ?? []);
    } catch {
      void 0;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadContactos = useCallback(async () => {
    setContactosLoading(true);
    try {
      const response = await api.get<ContactosResponse>('/v1/mobile/config/contactos');
      setContactos(response.data);
    } catch {
      setContactos(null);
    } finally {
      setContactosLoading(false);
    }
  }, []);

  const loadTopArticulos = useCallback(async () => {
    setArticulosLoading(true);
    try {
      const response = await api.get<ArticulosResponse>('/v1/mobile/kb/articulos?limit=5');
      setTopArticulos(response.data ?? []);
    } catch {
      setTopArticulos([]);
    } finally {
      setArticulosLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadTickets();
      void loadContactos();
      void loadTopArticulos();
    }, [loadTickets, loadContactos, loadTopArticulos]),
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      api
        .get<ArticulosResponse>(
          `/v1/mobile/kb/articulos?q=${encodeURIComponent(trimmed)}&limit=8`,
        )
        .then((response) => setSearchResults(response.data ?? []))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([loadTickets(), loadTopArticulos()]);
    setRefreshing(false);
  }

  const ticketItems = useMemo<WalletStackItem[]>(() => {
    return tickets.map((t) => {
      const status = ticketStatusLabel[t.estatus];
      const isActive = ACTIVE_STATUSES.has(t.estatus);
      const state = bucketByAge(isActive, t.created_at);
      return {
        id: t.id,
        state,
        card: (
          <WalletCard
            state={state}
            tone={status.tone}
            title={t.asunto}
            meta={`#${t.id.slice(0, 8).toUpperCase()}`}
            badge={<StatusBadge label={status.label} tone={status.tone} />}
            onPress={() => router.push(`/support/${t.id}`)}
          >
            <HStack className="items-center justify-between">
              <Text
                style={{
                  color:
                    state === 'archived'
                      ? palette.textTertiary
                      : palette.textSecondary,
                  fontSize: 12,
                }}
                className="capitalize"
              >
                {t.categoria.replace(/_/g, ' ')}
              </Text>
              <Text style={{ color: palette.textTertiary, fontSize: 11 }}>
                {formatDateLong(t.created_at)}
              </Text>
            </HStack>
          </WalletCard>
        ),
      };
    });
  }, [tickets, router]);

  const showSearchResults = searchQuery.trim().length >= 2;

  return (
    <ScreenShell>
      <ScreenHeader title="Soporte" subtitle="Te ayudamos a resolver." />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={palette.brand}
          />
        }
      >
        <VStack className="gap-5">
          <Input className="h-12">
            <InputSlot className="pl-3">
              <MagnifyingGlass size={18} color={palette.textTertiary} weight="regular" />
            </InputSlot>
            <InputField
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="¿Con qué te ayudamos?"
              placeholderTextColor={palette.textTertiary}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              style={{ letterSpacing: 0 }}
            />
          </Input>

          {showSearchResults ? (
            <VStack className="gap-2">
              <Heading className="text-sm font-bold text-foreground-secondary uppercase">
                Resultados
              </Heading>
              {searching ? (
                <VStack className="gap-2">
                  {[0, 1, 2, 3].map((i) => (
                    <ListRowSkeleton key={`search-skeleton-${i}`} />
                  ))}
                </VStack>
              ) : searchResults.length === 0 ? (
                <Box className="py-6 px-4 rounded-xl bg-muted">
                  <Text className="text-sm text-foreground-secondary text-center">
                    Sin resultados. Intenta con otras palabras.
                  </Text>
                </Box>
              ) : (
                <VStack className="gap-2">
                  {searchResults.map((a) => (
                    <Pressable
                      key={a.id}
                      onPress={() => router.push(`/support/articulo/${a.slug}`)}
                    >
                      <HStack className="bg-card border border-border rounded-xl p-4 gap-3 items-center">
                        <VStack className="flex-1 gap-0.5">
                          <Text className="text-sm font-semibold text-foreground" numberOfLines={2}>
                            {a.titulo}
                          </Text>
                          {a.resumen ? (
                            <Text
                              className="text-xs text-foreground-secondary"
                              numberOfLines={2}
                            >
                              {a.resumen}
                            </Text>
                          ) : null}
                        </VStack>
                        <CaretRight size={16} color={palette.textTertiary} />
                      </HStack>
                    </Pressable>
                  ))}
                </VStack>
              )}
            </VStack>
          ) : (
            <>
              <VStack className="gap-2">
                <Heading className="text-base font-bold text-foreground">
                  Preguntas frecuentes
                </Heading>
                {articulosLoading ? (
                  <VStack className="gap-2">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <ListRowSkeleton key={`faq-skeleton-${i}`} />
                    ))}
                  </VStack>
                ) : topArticulos.length === 0 ? (
                  <Box className="py-5 px-4 rounded-xl bg-muted">
                    <Text className="text-sm text-foreground-secondary text-center">
                      Aún no hay artículos disponibles.
                    </Text>
                  </Box>
                ) : (
                  <VStack className="gap-2">
                    {topArticulos.map((a) => (
                      <Pressable
                        key={a.id}
                        onPress={() => router.push(`/support/articulo/${a.slug}`)}
                      >
                        <HStack className="bg-card border border-border rounded-xl p-4 gap-3 items-center">
                          <VStack className="flex-1 gap-0.5">
                            <Text
                              className="text-sm font-semibold text-foreground"
                              numberOfLines={2}
                            >
                              {a.titulo}
                            </Text>
                            {a.resumen ? (
                              <Text
                                className="text-xs text-foreground-secondary"
                                numberOfLines={2}
                              >
                                {a.resumen}
                              </Text>
                            ) : null}
                          </VStack>
                          <CaretRight size={16} color={palette.textTertiary} />
                        </HStack>
                      </Pressable>
                    ))}
                  </VStack>
                )}
              </VStack>

              <Pressable onPress={() => router.push('/support/seleccionar-pedido')}>
                <HStack className="bg-primary rounded-xl px-5 py-4 items-center gap-3">
                  <Box className="w-10 h-10 rounded-lg bg-white/15 items-center justify-center">
                    <Receipt size={22} color={palette.surface} weight="duotone" />
                  </Box>
                  <VStack className="flex-1 gap-0.5">
                    <Text className="text-base font-bold text-white">
                      Resolver problema con un pedido
                    </Text>
                    <Text className="text-xs text-white/80">
                      Reembolsos guiados, validaciones y pasos recomendados.
                    </Text>
                  </VStack>
                  <CaretRight size={18} color={palette.surface} />
                </HStack>
              </Pressable>

              <VStack className="gap-2">
                <Heading className="text-base font-bold text-foreground">
                  Tus reportes
                </Heading>
                {loading && ticketItems.length === 0 ? (
                  <VStack className="gap-2">
                    <ListRowSkeleton showLeading />
                    <ListRowSkeleton showLeading />
                    <ListRowSkeleton showLeading />
                  </VStack>
                ) : (
                  <WalletStack
                    items={ticketItems}
                    archivedLabel={(n) =>
                      n === 1 ? '1 reporte anterior' : `${n} reportes anteriores`
                    }
                    emptyState={
                      <EmptyState
                        icon={
                          <TicketIcon size={22} color={palette.brand} weight="duotone" />
                        }
                        title="Sin reportes"
                        description="Cuando reportes un problema aparecerá aquí."
                      />
                    }
                  />
                )}
              </VStack>

              <VStack className="gap-2 pt-2">
                <Heading className="text-base font-bold text-foreground">
                  Casos especiales
                </Heading>
                <Text className="text-xs text-foreground-secondary">
                  Usa contacto humano si la guía no cubre tu caso o hay riesgo de seguridad.
                </Text>
                {contactosLoading || !contactos ? (
                  <Box className="py-4 px-4 rounded-xl bg-muted">
                    <Text className="text-sm text-foreground-secondary text-center">
                      Cargando contactos...
                    </Text>
                  </Box>
                ) : (
                  <HStack className="gap-2">
                    {contactos.telefono ? (
                      <Pressable
                        onPress={() => Linking.openURL(`tel:${contactos.telefono}`)}
                        style={{ flex: 1 }}
                      >
                        <VStack className="bg-card border border-border rounded-xl py-3 items-center gap-1">
                          <Phone size={18} color={palette.textPrimary} weight="regular" />
                          <Text className="text-xs font-semibold text-foreground">Llamar</Text>
                        </VStack>
                      </Pressable>
                    ) : null}
                    {contactos.whatsapp ? (
                      <Pressable
                        onPress={() => Linking.openURL(buildWhatsappUrl(contactos.whatsapp!))}
                        style={{ flex: 1 }}
                      >
                        <VStack className="bg-card border border-border rounded-xl py-3 items-center gap-1">
                          <ChatCircleDots size={18} color={palette.textPrimary} weight="regular" />
                          <Text className="text-xs font-semibold text-foreground">WhatsApp</Text>
                        </VStack>
                      </Pressable>
                    ) : null}
                    {contactos.email ? (
                      <Pressable
                        onPress={() => Linking.openURL(`mailto:${contactos.email}`)}
                        style={{ flex: 1 }}
                      >
                        <VStack className="bg-card border border-border rounded-xl py-3 items-center gap-1">
                          <EnvelopeSimple size={18} color={palette.textPrimary} weight="regular" />
                          <Text className="text-xs font-semibold text-foreground">Email</Text>
                        </VStack>
                      </Pressable>
                    ) : null}
                  </HStack>
                )}

                <Box className="pt-2">
                  <SupportPinSection />
                </Box>
              </VStack>
            </>
          )}
        </VStack>
      </ScrollView>
    </ScreenShell>
  );
}
