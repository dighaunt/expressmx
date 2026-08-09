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
import { api, ApiError } from '@/lib/api/client';

type Categoria = 'cobro_incorrecto' | 'no_show' | 'dano_propiedad' | 'queja_servicio' | 'otro';

const CATEGORY_TITLE: Record<Categoria, string> = {
  cobro_incorrecto: 'Pago o bono incorrecto',
  no_show: 'Cliente no estaba en la dirección',
  dano_propiedad: 'Daño en herramienta o propiedad',
  queja_servicio: 'Cliente agresivo o incidente',
  otro: 'Otro problema',
};

export default function SupportNewScreen() {
  const router = useRouter();
  const { categoria, orden_id, asunto: asuntoInicial } = useLocalSearchParams<{
    categoria?: Categoria;
    orden_id?: string;
    asunto?: string;
  }>();
  const safeCat: Categoria =
    categoria && CATEGORY_TITLE[categoria as Categoria] ? (categoria as Categoria) : 'otro';

  const [asunto, setAsunto] = useState(asuntoInicial ?? '');
  const [descripcion, setDescripcion] = useState('');
  const [ordenId, setOrdenId] = useState(orden_id ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ asunto?: string; descripcion?: string }>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  function validate(): boolean {
    const next: { asunto?: string; descripcion?: string } = {};
    if (!asunto.trim()) next.asunto = 'Resume en una línea qué pasó.';
    else if (asunto.trim().length < 5) next.asunto = 'Necesitamos un poco más de contexto.';
    if (!descripcion.trim()) next.descripcion = 'Cuéntanos los detalles para que podamos ayudarte.';
    else if (descripcion.trim().length < 15) {
      next.descripcion = 'Mientras más nos cuentes, más rápido te ayudamos.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit() {
    setGlobalError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      await api.post('/v1/mobile/tickets', {
        categoria: safeCat,
        asunto: asunto.trim(),
        descripcion: descripcion.trim(),
        orden_id: ordenId.trim() || undefined,
      });
      router.back();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'No pudimos abrir tu reporte.';
      setGlobalError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenShell>
      <ScreenHeader
        title="Reportar"
        subtitle={CATEGORY_TITLE[safeCat]}
      />

      <KeyboardAwareForm
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 20, paddingBottom: 100 }}
      >
        <VStack className="gap-4">
          {globalError ? <InlineAlert tone="danger" message={globalError} /> : null}

          <Box className="bg-info-soft rounded-xl p-3.5">
            <Text className="text-sm text-info">
              Un agente de soporte va a leer tu reporte y te contactará por la app o por teléfono. Tiempo
              promedio de respuesta: bajo 30 minutos.
            </Text>
          </Box>

          <FormField
            label="Asunto"
            value={asunto}
            onChangeText={setAsunto}
            placeholder="Ej. Cliente no abrió en orden #4821"
            autoCapitalize="sentences"
            returnKeyType="next"
            maxLength={120}
            error={errors.asunto}
          />

          <FormField
            label="Descripción"
            value={descripcion}
            onChangeText={setDescripcion}
            placeholder="Cuéntanos qué pasó, a qué hora y cualquier dato útil"
            multiline
            numberOfLines={5}
            maxLength={1000}
            autoCapitalize="sentences"
            error={errors.descripcion}
          />

          <FormField
            label="Orden relacionada (opcional)"
            value={ordenId}
            onChangeText={setOrdenId}
            placeholder="ID o número de orden"
            autoCapitalize="characters"
            autoCorrect={false}
            helper="Si el problema es de una orden específica, ayuda mucho compartir su ID."
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
