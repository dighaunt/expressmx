import { useLocalSearchParams, useRouter } from 'expo-router';
import { Bank, CreditCard, Plus, Tag } from 'phosphor-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { Box } from '@/components/ui/box';
import { Divider } from '@/components/ui/divider';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { BottomBar } from '@/components/ui-app/bottom-bar';
import { InlineAlert } from '@/components/ui-app/inline-alert';
import { PrimaryButton } from '@/components/ui-app/primary-button';
import { ScreenHeader } from '@/components/ui-app/screen-header';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { SelectableCard } from '@/components/ui-app/selectable-card';
import { api, ApiError } from '@/lib/api/client';
import { formatPrice } from '@/lib/format';
import { usePaymentSheet } from '@/lib/payments/stripe';
import { palette } from '@/lib/theme/tokens';

interface OrderDetail {
  id: string;
  total: number;
  descuento: number;
  cupon_codigo: string | null;
  servicio_nombre: string;
  pago_pendiente?: boolean;
}

interface OrderDetailResponse {
  orden: OrderDetail;
}

interface MetodoGuardado {
  id: string;
  marca: string | null;
  ultimos_4: string | null;
  vence_mes: number | null;
  vence_ano: number | null;
  predeterminado: boolean;
}

interface MetodosResponse {
  data: MetodoGuardado[];
}

interface IntentResponse {
  data: {
    pago_id: string;
    payment_intent_id: string;
    client_secret: string;
    amount_centavos: number;
    currency: string;
    customer_id: string;
    ephemeral_key: string | null;
    publishable_key?: string;
  };
}

const NEW_CARD_ID = '__new_card__';

export default function PaymentScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { stripeAvailable, initPaymentSheet, presentPaymentSheet } = usePaymentSheet();

  const [orden, setOrden] = useState<OrderDetail | null>(null);
  const [metodos, setMetodos] = useState<MetodoGuardado[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selected, setSelected] = useState<string>(NEW_CARD_ID);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'danger' | 'info'; message: string } | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoadError('Falta el identificador del pedido.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    Promise.all([
      api.get<OrderDetailResponse>(`/v1/mobile/orders/${id}`),
      api
        .get<MetodosResponse>('/v1/mobile/payments/methods')
        .catch(() => ({ data: [] as MetodoGuardado[] })),
    ])
      .then(([ordenRes, metodosRes]) => {
        if (cancelled) return;
        setOrden(ordenRes.orden);
        setMetodos(metodosRes.data);
        const predeterminado = metodosRes.data.find((m) => m.predeterminado);
        setSelected(predeterminado?.id ?? NEW_CARD_ID);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof ApiError ? err.message : 'No pudimos cargar el pedido.';
        setLoadError(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const total = orden?.total ?? 0;
  const descuento = orden?.descuento ?? 0;
  const subtotal = total + descuento;

  const handlePay = useCallback(async () => {
    if (!id || !orden || paying) return;
    if (!stripeAvailable) {
      setFeedback({
        tone: 'info',
        message: 'El checkout seguro de Stripe está disponible desde la app móvil.',
      });
      return;
    }
    setPaying(true);
    setFeedback(null);
    try {
      const intentRes = await api.post<IntentResponse>('/v1/mobile/payments/intent', {
        orden_id: id,
      });
      const { client_secret, ephemeral_key, customer_id } = intentRes.data;

      const initRes = await initPaymentSheet({
        paymentIntentClientSecret: client_secret,
        customerEphemeralKeySecret: ephemeral_key ?? undefined,
        customerId: customer_id,
        merchantDisplayName: 'ExpressMX',
        allowsDelayedPaymentMethods: false,
        returnURL: 'expressmx://stripe-redirect',
      });
      if (initRes.error) {
        setFeedback({ tone: 'danger', message: initRes.error.message });
        return;
      }

      const sheetRes = await presentPaymentSheet();
      if (sheetRes.error) {
        if (sheetRes.error.code !== 'Canceled') {
          setFeedback({ tone: 'danger', message: sheetRes.error.message });
        }
        return;
      }

      router.replace({ pathname: '/order-tracking', params: { id } });
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'No pudimos iniciar el pago.';
      setFeedback({ tone: 'danger', message });
    } finally {
      setPaying(false);
    }
  }, [id, orden, paying, stripeAvailable, initPaymentSheet, presentPaymentSheet, router]);

  const orderShortId = (id ?? 'XXXXXXXX').slice(0, 8).toUpperCase();
  let paymentButtonLabel = `Pagar ${formatPrice(total, true)} a ExpressMX`;
  if (!stripeAvailable) {
    paymentButtonLabel = 'Continúa desde la app móvil';
  } else if (paying) {
    paymentButtonLabel = 'Procesando...';
  }

  return (
    <ScreenShell applyBottomInset={false}>
      <ScreenHeader title="Pago" subtitle={`Pedido #${orderShortId}`} />
      {loading ? (
        <Box className="flex-1 items-center justify-center">
          <Spinner color={palette.brandStrong} />
        </Box>
      ) : loadError || !orden ? (
        <Box className="flex-1 px-5 justify-center">
          <InlineAlert
            tone="danger"
            title="No pudimos cargar el pago"
            message={loadError ?? 'Pedido no disponible.'}
          />
        </Box>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
            <VStack className="gap-4">
              <Box className="bg-card border border-border rounded-2xl overflow-hidden">
                <Box className="p-4 bg-muted">
                  <Text className="text-xs text-foreground-secondary">Servicio</Text>
                  <Text className="text-base font-bold text-foreground">{orden.servicio_nombre}</Text>
                </Box>
                <VStack className="p-4 gap-2">
                  <HStack className="justify-between items-baseline">
                    <Text className="text-sm text-foreground flex-1 pr-3">Subtotal</Text>
                    <Text className="text-sm font-semibold text-foreground">
                      {formatPrice(subtotal, true)}
                    </Text>
                  </HStack>

                  {descuento > 0 ? (
                    <HStack className="justify-between items-center pt-1">
                      <HStack className="items-center gap-1.5">
                        <Tag size={14} color={palette.success} weight="fill" />
                        <Text className="text-sm text-success font-semibold">
                          Cupón {orden.cupon_codigo ?? 'aplicado'}
                        </Text>
                      </HStack>
                      <Text className="text-sm font-semibold text-success">
                        -{formatPrice(descuento, true)}
                      </Text>
                    </HStack>
                  ) : null}

                  <Divider />

                  <HStack className="justify-between items-baseline pt-1">
                    <Heading className="text-base font-bold text-foreground">Total a ExpressMX</Heading>
                    <Heading className="text-2xl font-bold text-primary">
                      {formatPrice(total, true)}
                    </Heading>
                  </HStack>
                </VStack>
              </Box>

              <Text className="text-xs uppercase tracking-wide text-foreground-secondary mt-2">
                Pago a ExpressMX
              </Text>
              <Heading className="text-base font-bold text-foreground -mt-3">Método de pago</Heading>

              {!stripeAvailable ? (
                <InlineAlert
                  tone="info"
                  title="Disponible en la app móvil"
                  message="Abre ExpressMX en iOS o Android para completar el pago seguro con Stripe."
                />
              ) : null}

              <VStack className="gap-2">
                {metodos.map((m) => {
                  const titulo =
                    m.marca && m.ultimos_4
                      ? `${m.marca} •••• ${m.ultimos_4}`
                      : 'Tarjeta guardada';
                  const detalle =
                    m.vence_mes && m.vence_ano
                      ? `Vence ${String(m.vence_mes).padStart(2, '0')}/${String(m.vence_ano).slice(-2)}`
                      : 'Stripe';
                  return (
                    <SelectableCard
                      key={m.id}
                      selected={selected === m.id}
                      onSelect={() => setSelected(m.id)}
                      title={titulo}
                      description={detalle}
                      icon={
                        <Box className="w-10 h-10 rounded-lg bg-card items-center justify-center border border-border">
                          <CreditCard size={22} color={palette.brandStrong} weight="duotone" />
                        </Box>
                      }
                    />
                  );
                })}

                <SelectableCard
                  selected={selected === NEW_CARD_ID}
                  onSelect={() => setSelected(NEW_CARD_ID)}
                  title="Pagar con tarjeta nueva"
                  description="Stripe abrirá el formulario seguro"
                  icon={
                    <Box className="w-10 h-10 rounded-lg bg-muted items-center justify-center">
                      <Plus size={18} color={palette.textTertiary} weight="bold" />
                    </Box>
                  }
                  trailing={<Bank size={18} color={palette.textTertiary} />}
                />
              </VStack>

              {feedback ? (
                <InlineAlert tone={feedback.tone} message={feedback.message} />
              ) : null}
            </VStack>
          </ScrollView>

          <BottomBar>
            <PrimaryButton
              onPress={handlePay}
              loading={paying}
              disabled={total <= 0 || !stripeAvailable}
            >
              {paymentButtonLabel}
            </PrimaryButton>
          </BottomBar>
        </>
      )}
    </ScreenShell>
  );
}
