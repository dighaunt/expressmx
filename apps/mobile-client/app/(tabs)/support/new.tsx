import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { BottomBar } from '@/components/ui-app/bottom-bar';
import { FormField } from '@/components/ui-app/form-field';
import { InlineAlert } from '@/components/ui-app/inline-alert';
import { KeyboardAwareForm } from '@/components/ui-app/keyboard-aware-form';
import { PrimaryButton } from '@/components/ui-app/primary-button';
import { ScreenHeader } from '@/components/ui-app/screen-header';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { SelectableCard } from '@/components/ui-app/selectable-card';
import { api, ApiError } from '@/lib/api/client';

type Categoria = 'cobro_incorrecto' | 'no_show' | 'queja_servicio' | 'dano_propiedad' | 'otro';

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

export default function ClientSupportNewScreen() {
  const router = useRouter();
  const { categoria: catParam } = useLocalSearchParams<{ categoria?: string }>();
  const initialCat = CATEGORIES.find((c) => c.value === catParam)?.value;

  const [categoria, setCategoria] = useState<Categoria | null>(initialCat ?? null);
  const [asunto, setAsunto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    categoria?: string;
    asunto?: string;
    descripcion?: string;
  }>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  function validate(): boolean {
    const next: typeof errors = {};
    if (!categoria) next.categoria = 'Selecciona el tipo de problema.';
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
    if (!validate() || !categoria) return;
    setSubmitting(true);
    try {
      await api.post('/v1/mobile/tickets', {
        categoria,
        asunto: asunto.trim(),
        descripcion: descripcion.trim(),
      });
      router.back();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'No pudimos abrir tu reporte.';
      setGlobalError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenShell>
      <ScreenHeader title="Nuevo reporte" subtitle="Te respondemos en menos de 30 minutos." />

      <KeyboardAwareForm
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 20, paddingBottom: 100 }}
      >
        <VStack className="gap-4">
          {globalError ? <InlineAlert tone="danger" message={globalError} /> : null}

          <Box>
            <Text className="text-sm font-semibold text-foreground mb-2">Tipo de problema</Text>
            <VStack className="gap-2">
              {CATEGORIES.map((c) => (
                <SelectableCard
                  key={c.value}
                  selected={categoria === c.value}
                  onSelect={() => setCategoria(c.value)}
                  title={c.label}
                  description={c.helper}
                />
              ))}
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
