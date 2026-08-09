import { useLocalSearchParams, useRouter } from 'expo-router';
import { Receipt } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { BottomBar } from '@/components/ui-app/bottom-bar';
import { FormField } from '@/components/ui-app/form-field';
import { InlineAlert } from '@/components/ui-app/inline-alert';
import { KeyboardAwareForm } from '@/components/ui-app/keyboard-aware-form';
import { PrimaryButton } from '@/components/ui-app/primary-button';
import { ScreenHeader } from '@/components/ui-app/screen-header';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { api, ApiError } from '@/lib/api/client';
import { formatPrice } from '@/lib/format';
import { palette } from '@/lib/theme/tokens';

type Categoria = 'cobro_incorrecto' | 'no_show' | 'queja_servicio' | 'dano_propiedad' | 'otro';
type ReembolsoMotivo =
  | 'cobro_duplicado'
  | 'monto_incorrecto'
  | 'servicio_no_recibido'
  | 'cargo_no_reconocido';
type ReembolsoElegibilidad = 'candidato' | 'revision_manual';

const CATEGORIES: { value: Categoria; label: string; helper: string }[] = [
  {
    value: 'cobro_incorrecto',
    label: 'Cobro incorrecto',
    helper: 'Te cobraron de más, mal o duplicado.',
  },
  {
    value: 'no_show',
    label: 'No llegó el prestador',
    helper: 'Reservaste un servicio y nadie se presentó.',
  },
  {
    value: 'queja_servicio',
    label: 'Queja del servicio',
    helper: 'Mala atención, retraso, trato inadecuado.',
  },
  {
    value: 'dano_propiedad',
    label: 'Daño a tu propiedad',
    helper: 'Algo se rompió o se dañó durante el servicio.',
  },
  {
    value: 'otro',
    label: 'Otro problema',
    helper: 'Cuéntanos lo que pasó.',
  },
];

const REFUND_REASON_LABEL: Record<ReembolsoMotivo, string> = {
  cobro_duplicado: 'Cobro duplicado',
  monto_incorrecto: 'Monto incorrecto',
  servicio_no_recibido: 'Servicio no recibido',
  cargo_no_reconocido: 'Cargo no reconocido',
};

function isRefundReason(value: string | undefined): value is ReembolsoMotivo {
  return Boolean(value && value in REFUND_REASON_LABEL);
}

function isRefundEligibility(value: string | undefined): value is ReembolsoElegibilidad {
  return value === 'candidato' || value === 'revision_manual';
}

interface OrderDetail {
  id: string;
  servicio_nombre: string;
  total: number;
}

interface OrderDetailResponse {
  orden: OrderDetail;
}

interface TicketCreatedResponse {
  data: {
    id: string;
  };
}

export default function ReportarProblemaScreen() {
  const router = useRouter();
  const {
    id,
    categoria: catParam,
    motivo_reembolso: refundParam,
    elegibilidad: eligibilityParam,
  } = useLocalSearchParams<{
    id: string;
    categoria?: string;
    motivo_reembolso?: string;
    elegibilidad?: string;
  }>();

  const initialCat = CATEGORIES.find((c) => c.value === catParam)?.value;
  const refundReason = isRefundReason(refundParam) ? refundParam : null;
  const refundEligibility = isRefundEligibility(eligibilityParam) ? eligibilityParam : null;
  const isRefundFlow =
    initialCat === 'cobro_incorrecto' &&
    refundReason !== null &&
    refundEligibility !== null;
  const initialSubject = refundReason ? REFUND_REASON_LABEL[refundReason] : '';

  const [orden, setOrden] = useState<OrderDetail | null>(null);
  const [loadingOrden, setLoadingOrden] = useState(true);
  const [missing, setMissing] = useState(false);

  const [categoria, setCategoria] = useState<Categoria | null>(initialCat ?? null);
  const [asunto, setAsunto] = useState(isRefundFlow ? initialSubject : '');
  const [descripcion, setDescripcion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    categoria?: string;
    asunto?: string;
    descripcion?: string;
  }>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api
      .get<OrderDetailResponse>(`/v1/mobile/orders/${id}`)
      .then((response) => {
        if (!cancelled) setOrden(response.orden);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingOrden(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  function validate(): boolean {
    const next: typeof errors = {};
    if (!categoria) next.categoria = 'Selecciona el tipo de problema.';
    if (categoria === 'cobro_incorrecto' && !isRefundFlow) {
      next.categoria = 'Valida primero tu reembolso desde la guía del pedido.';
    }
    if (!asunto.trim()) next.asunto = 'Resume en una línea qué pasó.';
    else if (asunto.trim().length < 5) next.asunto = 'Necesitamos un poco más de contexto.';
    if (!descripcion.trim()) next.descripcion = 'Cuéntanos los detalles.';
    else if (descripcion.trim().length < 15) {
      next.descripcion = 'Mientras más nos cuentes, más rápido te ayudamos.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit() {
    setGlobalError(null);
    if (!validate() || !categoria || !id) return;
    setSubmitting(true);
    try {
      const payload = {
        orden_id: id,
        categoria,
        asunto: asunto.trim(),
        descripcion: descripcion.trim(),
        ...(isRefundFlow
          ? {
              diagnostico: {
                tipo: 'reembolso',
                motivo: refundReason,
                elegibilidad: refundEligibility,
              },
            }
          : {}),
      };
      const response = await api.post<TicketCreatedResponse>('/v1/mobile/tickets', payload);
      router.replace(`/support/${response.data.id}`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'No pudimos abrir tu reporte.';
      setGlobalError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingOrden) {
    return (
      <ScreenShell>
        <ScreenHeader title="Reportar problema" />
        <Box className="flex-1 items-center justify-center">
          <Spinner color={palette.brand} />
        </Box>
      </ScreenShell>
    );
  }

  if (missing || !orden) {
    return (
      <ScreenShell>
        <ScreenHeader title="Reportar problema" />
        <Box className="flex-1 items-center justify-center px-6">
          <Receipt size={32} color={palette.textTertiary} weight="duotone" />
          <Text className="mt-3 text-base font-semibold text-foreground text-center">
            No encontramos este pedido
          </Text>
          <Text className="mt-1 text-sm text-foreground-secondary text-center">
            Vuelve al listado para abrir un reporte.
          </Text>
          <Box className="w-full mt-6">
            <PrimaryButton onPress={() => router.replace('/(tabs)/orders')}>
              Ver mis pedidos
            </PrimaryButton>
          </Box>
        </Box>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <ScreenHeader
        title="Reportar problema"
        subtitle="Te respondemos en menos de 30 minutos."
      />

      <KeyboardAwareForm
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 20, paddingBottom: 100 }}
      >
        <VStack className="gap-4">
          <Text className="text-xs text-foreground-secondary">
            Pedido #{orden.id.slice(0, 8).toUpperCase()} {'›'} Soporte {'›'} Reportar
          </Text>

          <Box className="bg-muted rounded-xl p-4">
            <Text className="text-xs text-foreground-secondary uppercase tracking-wide font-bold mb-1">
              Reportando problema de
            </Text>
            <Text className="text-base font-bold text-foreground" numberOfLines={2}>
              {orden.servicio_nombre}
            </Text>
            <HStack className="items-center justify-between mt-1">
              <Text className="text-xs text-foreground-secondary">
                Pedido #{orden.id.slice(0, 8).toUpperCase()}
              </Text>
              <Text className="text-sm font-semibold text-foreground">
                {formatPrice(orden.total)}
              </Text>
            </HStack>
          </Box>

          {globalError ? (
            <InlineAlert tone="danger" title="No pudimos abrir tu reporte" message={globalError} />
          ) : null}

          {isRefundFlow ? (
            <InlineAlert
              tone={refundEligibility === 'candidato' ? 'success' : 'warning'}
              title={
                refundEligibility === 'candidato'
                  ? 'Pedido candidato a reembolso'
                  : 'Revisión especializada'
              }
              message={`Motivo: ${REFUND_REASON_LABEL[refundReason]}. Revisaremos la información antes de confirmar cualquier devolución.`}
            />
          ) : null}

          <Box>
            <Text className="text-sm font-semibold text-foreground mb-2">Tipo de problema</Text>
            <VStack className="gap-2">
              {CATEGORIES.map((c) => {
                const selected = categoria === c.value;
                return (
                  <Pressable
                    key={c.value}
                    onPress={() => setCategoria(c.value)}
                    hitSlop={4}
                  >
                    <HStack
                      className={
                        'rounded-xl border p-4 gap-3 items-start ' +
                        (selected
                          ? 'border-primary bg-primary-soft'
                          : 'border-border bg-card')
                      }
                    >
                      <Box
                        className={
                          'w-5 h-5 rounded-full border-2 mt-0.5 ' +
                          (selected ? 'border-primary bg-primary' : 'border-border')
                        }
                      />
                      <VStack className="flex-1 gap-0.5">
                        <Text className="text-sm font-semibold text-foreground">{c.label}</Text>
                        <Text className="text-xs text-foreground-secondary">{c.helper}</Text>
                      </VStack>
                    </HStack>
                  </Pressable>
                );
              })}
            </VStack>
            {errors.categoria ? (
              <Text className="text-xs text-danger mt-1">{errors.categoria}</Text>
            ) : null}
          </Box>

          <FormField
            label="Asunto"
            value={asunto}
            onChangeText={setAsunto}
            placeholder="Ej. El prestador no llegó a la cita de las 10am"
            autoCapitalize="sentences"
            returnKeyType="next"
            maxLength={120}
            error={errors.asunto}
          />

          <FormField
            label="Descripción"
            value={descripcion}
            onChangeText={setDescripcion}
            placeholder="Cuéntanos qué pasó, a qué hora, y cualquier dato útil para ayudarte."
            multiline
            numberOfLines={5}
            maxLength={2000}
            autoCapitalize="sentences"
            error={errors.descripcion}
          />
        </VStack>
      </KeyboardAwareForm>

      <BottomBar>
        <PrimaryButton onPress={submit} loading={submitting} disabled={submitting}>
          {submitting ? 'Enviando...' : 'Enviar reporte'}
        </PrimaryButton>
      </BottomBar>
    </ScreenShell>
  );
}
