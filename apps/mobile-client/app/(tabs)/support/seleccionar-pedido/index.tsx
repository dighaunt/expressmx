import { useFocusEffect, useRouter } from 'expo-router';
import { CaretRight, Receipt, Phone as PhoneIcon } from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { Linking, ScrollView } from 'react-native';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { ScreenHeader } from '@/components/ui-app/screen-header';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { StatusBadge } from '@/components/ui-app/status-badge';
import { api } from '@/lib/api/client';
import { formatDateLong, formatPrice, relativeFromNow } from '@/lib/format';
import { estatusOrden, palette, type EstatusOrden, type Tone } from '@/lib/theme/tokens';

interface OrdenElegible {
  id: string;
  servicio_nombre: string;
  estatus: string;
  monto_total: number;
  fecha_programada: string | null;
  created_at: string;
  dentro_ventana: boolean;
  dias_desde_creacion: number;
  ya_tiene_ticket_abierto: boolean;
  ticket_abierto_id: string | null;
}

interface ElegiblesResponse {
  data: OrdenElegible[];
}

interface ContactosResponse {
  data: {
    telefono: string | null;
    whatsapp: string | null;
    email: string | null;
  };
}

function statusBadgeFor(estatus: string): { label: string; tone: Tone } {
  if (estatus in estatusOrden) {
    return estatusOrden[estatus as EstatusOrden];
  }
  return { label: estatus, tone: 'neutral' };
}

function fechaCorta(iso: string): string {
  const dias =
    (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
  if (dias < 7) return relativeFromNow(iso);
  return formatDateLong(iso);
}

export default function SeleccionarPedidoScreen() {
  const router = useRouter();
  const [ordenes, setOrdenes] = useState<OrdenElegible[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactos, setContactos] = useState<ContactosResponse['data'] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ord, cont] = await Promise.all([
        api.get<ElegiblesResponse>('/v1/mobile/orders/elegibles-soporte'),
        api.get<ContactosResponse>('/v1/mobile/config/contactos').catch(() => null),
      ]);
      setOrdenes(ord.data ?? []);
      if (cont) setContactos(cont.data);
    } catch {
      setOrdenes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function handlePress(o: OrdenElegible) {
    if (o.ya_tiene_ticket_abierto && o.ticket_abierto_id) {
      router.push(`/support/${o.ticket_abierto_id}`);
      return;
    }
    if (!o.dentro_ventana) {
      if (contactos?.telefono) {
        Linking.openURL(`tel:${contactos.telefono}`);
      }
      return;
    }
    router.push(`/support/guia/${o.id}`);
  }

  return (
    <ScreenShell applyBottomInset={false}>
      <ScreenHeader
        title="Selecciona el pedido"
        subtitle="¿Sobre cuál quieres reportar?"
      />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {loading ? (
          <Box className="py-10 items-center">
            <Spinner color={palette.brand} />
          </Box>
        ) : ordenes.length === 0 ? (
          <VStack className="gap-3">
            <Box className="py-10 px-5 rounded-xl bg-muted items-center">
              <Box className="w-12 h-12 rounded-xl bg-background items-center justify-center mb-3">
                <Receipt size={22} color={palette.brand} weight="duotone" />
              </Box>
              <Text className="text-sm font-semibold text-foreground text-center">
                No tienes pedidos recientes para reportar.
              </Text>
              <Text className="text-xs text-foreground-secondary text-center mt-1">
                ¿Necesitas ayuda con otra cosa?
              </Text>
            </Box>
            {contactos?.telefono ? (
              <Pressable onPress={() => Linking.openURL(`tel:${contactos.telefono}`)}>
                <HStack className="bg-card border border-border rounded-xl px-4 py-3.5 items-center gap-3">
                  <PhoneIcon size={20} color={palette.textPrimary} weight="regular" />
                  <Text className="flex-1 text-sm font-semibold text-foreground">
                    Llamar a soporte
                  </Text>
                  <CaretRight size={16} color={palette.textTertiary} />
                </HStack>
              </Pressable>
            ) : null}
          </VStack>
        ) : (
          <VStack className="gap-2">
            {ordenes.map((o) => {
              const status = statusBadgeFor(o.estatus);
              const fueraVentana = !o.dentro_ventana;
              const tieneTicket = o.ya_tiene_ticket_abierto;
              const disabled = fueraVentana && !contactos?.telefono;
              const cardClass = fueraVentana && !tieneTicket
                ? 'bg-muted border border-border'
                : 'bg-card border border-border';

              return (
                <Pressable
                  key={o.id}
                  onPress={() => handlePress(o)}
                  disabled={disabled}
                >
                  <VStack className={`rounded-xl p-4 gap-2 ${cardClass}`}>
                    <HStack className="items-center justify-between">
                      <Text className="text-xs text-foreground-secondary">
                        Pedido #{o.id.slice(0, 8).toUpperCase()}
                      </Text>
                      <StatusBadge label={status.label} tone={status.tone} />
                    </HStack>
                    <Text className="text-base font-semibold text-foreground" numberOfLines={2}>
                      {o.servicio_nombre}
                    </Text>
                    <HStack className="items-center justify-between">
                      <Text className="text-xs text-foreground-secondary">
                        {fechaCorta(o.created_at)}
                      </Text>
                      <Text className="text-sm font-semibold text-foreground">
                        {formatPrice(o.monto_total)}
                      </Text>
                    </HStack>
                    {tieneTicket ? (
                      <HStack className="mt-1 items-center justify-between">
                        <StatusBadge label="Caso en curso" tone="info" />
                        <HStack className="items-center gap-1">
                          <Text className="text-xs font-semibold text-primary">
                            Continuar conversación
                          </Text>
                          <CaretRight size={14} color={palette.brand} />
                        </HStack>
                      </HStack>
                    ) : fueraVentana ? (
                      <Text className="text-xs text-foreground-secondary mt-1">
                        Pedido fuera de ventana (más de 30 días). Llama a soporte si necesitas ayuda.
                      </Text>
                    ) : (
                      <HStack className="mt-1 items-center justify-end gap-1">
                        <Text className="text-xs font-semibold text-primary">
                          Resolver
                        </Text>
                        <CaretRight size={14} color={palette.brand} />
                      </HStack>
                    )}
                  </VStack>
                </Pressable>
              );
            })}
          </VStack>
        )}
      </ScrollView>
    </ScreenShell>
  );
}
