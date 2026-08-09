import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar, Clock, MapPin, Tag } from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { Stepper } from '@/components/stepper';
import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { FormField } from '@/components/ui-app/form-field';
import { InlineAlert } from '@/components/ui-app/inline-alert';
import { KeyboardAwareForm } from '@/components/ui-app/keyboard-aware-form';
import { PrimaryButton } from '@/components/ui-app/primary-button';
import { ScreenHeader } from '@/components/ui-app/screen-header';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { SelectableCard } from '@/components/ui-app/selectable-card';
import { api, ApiError } from '@/lib/api/client';
import { palette } from '@/lib/theme/tokens';

const REQUEST_STEPS = [
  { key: 'direccion', label: 'Dirección' },
  { key: 'fecha', label: 'Fecha' },
  { key: 'detalles', label: 'Detalles' },
  { key: 'confirmar', label: 'Confirmar' },
] as const;

interface AddressItem {
  id: string;
  alias: string | null;
  calle: string;
  numero_ext: string;
  colonia: string;
  ciudad: string;
  predeterminada: boolean;
}

interface AddressesResponse {
  data: AddressItem[];
}

interface CreateOrderResponse {
  data: { id: string };
}

type Timing = 'now' | 'later';

interface SlotItem {
  starts_at: string;
  local_date: string;
  local_time: string;
  available_providers: number;
}

interface SlotsResponse {
  data: {
    timezone: string;
    server_time: string;
    slots: SlotItem[];
  };
}

export default function ServiceRequestScreen() {
  const { id, nombre, cupon, cupon_codigo } = useLocalSearchParams<{
    id: string;
    nombre?: string;
    cupon?: string;
    cupon_codigo?: string;
  }>();
  const router = useRouter();
  const [timing, setTiming] = useState<Timing>('now');
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [address, setAddress] = useState<AddressItem | null>(null);
  const [global, setGlobal] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const couponCode = cupon_codigo ?? cupon;
  const hasSlots = slots.length > 0;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([
        api.get<AddressesResponse>('/v1/mobile/addresses'),
        id
          ? api.get<SlotsResponse>(`/v1/mobile/services/${id}/slots`).catch(() => ({
              data: { timezone: 'America/Mexico_City', server_time: '', slots: [] as SlotItem[] },
            }))
          : Promise.resolve({
              data: { timezone: 'America/Mexico_City', server_time: '', slots: [] as SlotItem[] },
            }),
      ])
        .then(([response, slotResponse]) => {
          if (cancelled) return;
          const list = response.data ?? [];
          setAddress(list.find((d) => d.predeterminada) ?? list[0] ?? null);
          const nextSlots = slotResponse.data.slots ?? [];
          setSlots(nextSlots);
          setSelectedSlot(nextSlots[0]?.starts_at ?? null);
        })
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }, [id]),
  );

  async function handleSubmit() {
    if (!id) return;
    if (!address) {
      setGlobal('Elige o agrega una dirección para solicitar el servicio.');
      return;
    }
    const fecha_programada = timing === 'now' ? slots[0]?.starts_at : selectedSlot;
    if (!fecha_programada) {
      setGlobal('Elige un horario disponible para tu servicio.');
      return;
    }
    setGlobal(null);
    setSubmitting(true);
    try {
      const response = await api.post<CreateOrderResponse>('/v1/mobile/orders', {
        servicio_id: id,
        direccion_id: address?.id,
        fecha_programada,
        notas: notes.trim() || undefined,
        cupon_codigo: couponCode,
      });
      router.replace({ pathname: '/order-tracking', params: { id: response.data.id } });
    } catch (err) {
      const message = err instanceof ApiError ? formatApiError(err) : 'No pudimos crear tu pedido.';
      setGlobal(message);
    } finally {
      setSubmitting(false);
    }
  }

  const currentStepIndex = computeCurrentStepIndex({
    addressReady: address !== null,
    slotReady: Boolean(timing === 'now' ? slots[0] : selectedSlot),
    notes,
    submitting,
  });

  return (
    <ScreenShell>
      <ScreenHeader title="Solicitar servicio" subtitle={nombre ?? undefined} />
      <KeyboardAwareForm contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <VStack className="gap-4">
          <Stepper steps={[...REQUEST_STEPS]} currentStepIndex={currentStepIndex} />
          {global ? <InlineAlert tone="danger" message={global} /> : null}

          {couponCode ? (
            <HStack className="bg-success-soft rounded-xl p-3 gap-2 items-center">
              <Tag size={18} color={palette.success} weight="fill" />
              <Text className="text-sm font-semibold text-success flex-1">
                Promoción {couponCode} se aplicará al confirmar.
              </Text>
            </HStack>
          ) : null}

          <Pressable
            onPress={() =>
              router.push({
                pathname: '/(tabs)/addresses',
                params: {
                  select: '1',
                  returnTo: '/(tabs)/service-request',
                  id,
                  nombre,
                  cupon: couponCode,
                },
              })
            }
          >
            <HStack className="bg-card border border-border rounded-xl p-4 gap-3 items-center">
              <Box className="w-10 h-10 rounded-lg bg-primary-soft items-center justify-center">
                <MapPin size={20} color={palette.brand} weight="fill" />
              </Box>
              <VStack className="flex-1">
                <Text className="text-xs text-foreground-secondary">Dirección del servicio</Text>
                {address ? (
                  <>
                    <Text className="text-sm font-semibold text-foreground">
                      {address.alias ?? `${address.calle} ${address.numero_ext}`}
                    </Text>
                    <Text className="text-xs text-foreground-secondary" numberOfLines={1}>
                      {address.colonia}, {address.ciudad}
                    </Text>
                  </>
                ) : (
                  <Text className="text-sm font-semibold text-foreground">
                    Agrega o elige una dirección
                  </Text>
                )}
              </VStack>
              <Text className="text-sm font-semibold text-primary">Cambiar</Text>
            </HStack>
          </Pressable>

          <VStack className="gap-2">
            <Heading className="text-base font-bold text-foreground">¿Cuándo lo necesitas?</Heading>
            <HStack className="gap-2">
              <Box className="flex-1">
                <SelectableCard
                  selected={timing === 'now'}
                  onSelect={() => setTiming('now')}
                  disabled={!hasSlots}
                  title="Lo antes posible"
                  description={slots[0] ? formatSlotLabel(slots[0]) : 'Sin horarios disponibles ahora.'}
                  icon={
                    <Clock
                      size={20}
                      color={timing === 'now' ? palette.brand : palette.textTertiary}
                      weight="duotone"
                    />
                  }
                  trailing={<Box />}
                />
              </Box>
              <Box className="flex-1">
                <SelectableCard
                  selected={timing === 'later'}
                  onSelect={() => setTiming('later')}
                  disabled={!hasSlots}
                  title="Programar"
                  description={hasSlots ? 'Elige fecha y hora.' : 'No hay horarios disponibles.'}
                  icon={
                    <Calendar
                      size={20}
                      color={timing === 'later' ? palette.brand : palette.textTertiary}
                      weight="duotone"
                    />
                  }
                  trailing={<Box />}
                />
              </Box>
            </HStack>
            {!hasSlots ? (
              <InlineAlert
                tone="info"
                message="Por ahora no hay horarios para este servicio. Intenta más tarde o elige otro servicio."
              />
            ) : null}
          </VStack>

          {timing === 'later' ? (
            <VStack className="gap-2">
              <Text className="text-sm font-semibold text-foreground">
                Horario central de la Ciudad de México
              </Text>
              <HStack className="flex-wrap gap-2">
                {slots.slice(0, 12).map((slot) => {
                  const selected = selectedSlot === slot.starts_at;
                  return (
                    <Pressable key={slot.starts_at} onPress={() => setSelectedSlot(slot.starts_at)}>
                      <Box
                        className={`rounded-lg border px-3 py-2 ${
                          selected ? 'border-primary bg-primary-soft' : 'border-border bg-card'
                        }`}
                      >
                        <Text className={`text-xs font-semibold ${selected ? 'text-primary' : 'text-foreground'}`}>
                          {formatSlotLabel(slot)}
                        </Text>
                      </Box>
                    </Pressable>
                  );
                })}
              </HStack>
              {slots.length === 0 ? (
                <InlineAlert tone="info" message="No hay horarios disponibles para este servicio y dirección." />
              ) : null}
            </VStack>
          ) : null}

          <FormField
            label="Cuéntanos qué pasa"
            value={notes}
            onChangeText={setNotes}
            placeholder="Por ejemplo: hay una fuga en el lavabo del baño y gotea constantemente."
            multiline
            numberOfLines={5}
            maxLength={500}
            helper="Entre más detalle nos des, mejor preparamos al prestador."
          />

          <Box className="bg-muted rounded-xl p-4">
            <Text className="text-xs uppercase tracking-wide text-foreground-secondary">
              Cómo funciona el pago
            </Text>
            <Text className="text-sm text-foreground mt-1.5">
              Confirmamos tu solicitud sin cobro. Al terminar el servicio te enviaremos el desglose y
              podrás pagar a ExpressMX desde la app.
            </Text>
          </Box>

          <PrimaryButton onPress={handleSubmit} loading={submitting}>
            {submitting ? 'Confirmando...' : 'Confirmar solicitud'}
          </PrimaryButton>
        </VStack>
      </KeyboardAwareForm>
    </ScreenShell>
  );
}

interface StepInputs {
  addressReady: boolean;
  slotReady: boolean;
  notes: string;
  submitting: boolean;
}

function computeCurrentStepIndex({
  addressReady,
  slotReady,
  notes,
  submitting,
}: StepInputs): number {
  if (!addressReady) return 0;
  if (!slotReady) return 1;
  if (notes.trim() === '' && !submitting) return 2;
  return 3;
}

function formatSlotLabel(slot: SlotItem): string {
  const date = new Date(`${slot.local_date}T12:00:00`);
  const day = date.toLocaleDateString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return `${day} · ${slot.local_time}`;
}

function formatApiError(err: ApiError): string {
  const validationMessage = formatValidationDetails(err.details);
  return validationMessage ? `${err.message}: ${validationMessage}` : err.message;
}

function formatValidationDetails(details: unknown): string | null {
  if (!details || typeof details !== 'object') return null;
  const fieldErrors = 'fieldErrors' in details ? details.fieldErrors : null;
  if (!fieldErrors || typeof fieldErrors !== 'object') return null;

  const messages = Object.entries(fieldErrors)
    .flatMap(([field, value]) => {
      if (!Array.isArray(value)) return [];
      const label = ORDER_FIELD_LABELS[field] ?? field;
      return value
        .filter((message): message is string => typeof message === 'string' && message.trim() !== '')
        .map((message) => `${label}: ${formatValidationMessage(message)}`);
    });

  return messages.length > 0 ? messages.join(' · ') : null;
}

function formatValidationMessage(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes('required')) return 'es requerido';
  if (normalized.includes('invalid uuid')) return 'no tiene un identificador válido';
  if (normalized.includes('invalid datetime') || normalized.includes('invalid date')) {
    return 'no tiene una fecha válida';
  }
  if (normalized.includes('at most')) return 'excede el límite permitido';
  if (normalized.includes('at least')) return 'está incompleto';
  return message;
}

const ORDER_FIELD_LABELS: Record<string, string> = {
  servicio_id: 'Servicio',
  direccion_id: 'Dirección',
  fecha_programada: 'Horario',
  notas: 'Detalles',
  cupon_codigo: 'Cupón',
};
