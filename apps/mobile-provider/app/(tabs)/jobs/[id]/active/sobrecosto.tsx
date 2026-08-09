import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { BottomBar } from '@/components/ui-app/bottom-bar';
import { FormField } from '@/components/ui-app/form-field';
import { InlineAlert } from '@/components/ui-app/inline-alert';
import { KeyboardAwareForm } from '@/components/ui-app/keyboard-aware-form';
import { NumericInput } from '@/components/ui-app/numeric-input';
import { PrimaryButton } from '@/components/ui-app/primary-button';
import { ScreenHeader } from '@/components/ui-app/screen-header';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { api, ApiError } from '@/lib/api/client';
import { formatMxn, spacing } from '@/lib/theme/tokens';

const QUICK_AMOUNTS = [50, 100, 200, 500];

export default function SobrecostoScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [descripcion, setDescripcion] = useState('');
  const [montoText, setMontoText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ descripcion?: string; monto?: string }>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  function validate(): { ok: boolean; monto?: number } {
    const next: { descripcion?: string; monto?: string } = {};
    if (!descripcion.trim()) {
      next.descripcion = 'Describe el sobrecosto para que el cliente entienda qué autoriza.';
    } else if (descripcion.trim().length < 4) {
      next.descripcion = 'Necesitamos un poco más de detalle.';
    }

    const cleaned = montoText.replace(',', '.').trim();
    const monto = Number(cleaned);
    if (!cleaned) {
      next.monto = 'Pon el monto a cobrar.';
    } else if (!Number.isFinite(monto) || monto <= 0) {
      next.monto = 'El monto tiene que ser mayor a cero.';
    } else if (monto > 10000) {
      next.monto = 'Por seguridad, montos arriba de $10,000 los autoriza tu supervisor.';
    }
    setErrors(next);
    return { ok: Object.keys(next).length === 0, monto };
  }

  async function submit() {
    setGlobalError(null);
    const v = validate();
    if (!v.ok || v.monto === undefined) return;
    setSubmitting(true);
    try {
      await api.post(`/v1/mobile/provider/jobs/${id}/cargos-extra`, {
        descripcion: descripcion.trim(),
        monto: v.monto,
      });
      router.back();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'No pudimos enviar el sobrecosto.';
      setGlobalError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenShell>
      <ScreenHeader
        title="Reportar sobrecosto"
        subtitle="El cliente lo autoriza desde su app"
      />

      <KeyboardAwareForm
        contentContainerStyle={{
          paddingHorizontal: spacing.gutter,
          paddingVertical: spacing.gutter,
          paddingBottom: spacing.bottomBar,
        }}
      >
        <VStack className="gap-4">
          {globalError ? <InlineAlert tone="danger" message={globalError} /> : null}

          <Box className="bg-warning-soft rounded-xl p-3.5">
            <Text className="text-xs text-warning font-semibold mb-1 uppercase tracking-wide">
              Recuerda
            </Text>
            <Text className="text-sm text-foreground">
              El sobrecosto solo aplica si el cliente lo autoriza en su app. Mientras tanto el bono base no cambia.
            </Text>
          </Box>

          <FormField
            label="Descripción"
            value={descripcion}
            onChangeText={setDescripcion}
            placeholder="Ej. Cinta + empaque para llave"
            multiline
            numberOfLines={3}
            maxLength={140}
            returnKeyType="next"
            error={errors.descripcion}
          />

          <VStack className="gap-1.5 w-full">
            <Text className="text-sm font-medium text-foreground-secondary">Monto (MXN)</Text>
            <NumericInput
              value={montoText}
              onChangeText={setMontoText}
              placeholder="0"
              keyboardType="decimal-pad"
              size="lg"
              textAlign="right"
              isInvalid={Boolean(errors.monto)}
              errorText={errors.monto}
              returnKeyType="go"
              onSubmitEditing={submit}
            />
            {!errors.monto ? (
              <Text className="text-xs text-foreground-secondary">
                Sugerencias rápidas:
              </Text>
            ) : null}
            {!errors.monto ? (
              <Box className="flex-row flex-wrap gap-2 mt-1">
                {QUICK_AMOUNTS.map((m) => (
                  <Box
                    key={m}
                    className="px-3 py-1.5 rounded-full bg-muted"
                    onTouchEnd={() => setMontoText(m.toString())}
                  >
                    <Text className="text-xs font-semibold text-foreground">{formatMxn(m)}</Text>
                  </Box>
                ))}
              </Box>
            ) : null}
          </VStack>
        </VStack>
      </KeyboardAwareForm>

      <BottomBar>
        <PrimaryButton onPress={submit} loading={submitting} disabled={submitting}>
          {submitting ? 'Enviando...' : 'Enviar para aprobación'}
        </PrimaryButton>
      </BottomBar>
    </ScreenShell>
  );
}
