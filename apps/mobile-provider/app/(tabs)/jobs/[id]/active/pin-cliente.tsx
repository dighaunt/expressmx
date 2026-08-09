import { useLocalSearchParams, useRouter } from 'expo-router';
import { Lock } from 'phosphor-react-native';
import { useState } from 'react';
import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { BottomBar } from '@/components/ui-app/bottom-bar';
import { InlineAlert } from '@/components/ui-app/inline-alert';
import { KeyboardAwareForm } from '@/components/ui-app/keyboard-aware-form';
import { NumericInput } from '@/components/ui-app/numeric-input';
import { PrimaryButton } from '@/components/ui-app/primary-button';
import { ScreenHeader } from '@/components/ui-app/screen-header';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { api, ApiError } from '@/lib/api/client';
import { palette, spacing } from '@/lib/theme/tokens';

export default function PinClienteScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function validate() {
    setError(null);
    if (pin.length !== 6) {
      setError('El PIN tiene que ser de 6 dígitos.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/v1/mobile/provider/jobs/${id}/pin/cliente`, { pin });
      router.back();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.status === 400
            ? 'El PIN no coincide. Pídeselo de nuevo al cliente.'
            : err.message
          : 'No pudimos validar el PIN.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenShell>
      <ScreenHeader title="PIN del cliente" subtitle="Pídele su PIN para iniciar el servicio" />

      <KeyboardAwareForm
        contentContainerStyle={{
          paddingHorizontal: spacing.gutterLg,
          paddingTop: spacing.section,
          paddingBottom: spacing.bottomBar,
        }}
      >
        <VStack className="gap-5 items-stretch">
          <Box className="self-center w-16 h-16 rounded-2xl bg-primary-soft items-center justify-center">
            <Lock size={32} color={palette.brandStrong} weight="duotone" />
          </Box>

          <VStack className="items-center gap-1">
            <Heading className="text-xl font-bold text-foreground text-center">
              Ingresa el PIN
            </Heading>
            <Text className="text-sm text-foreground-secondary text-center">
              El cliente lo encuentra en su app, en la pantalla de seguimiento.
            </Text>
          </VStack>

          <NumericInput
            value={pin}
            onChangeText={(t) => setPin(t.replace(/\D/g, ''))}
            placeholder="------"
            keyboardType="number-pad"
            maxLength={6}
            letterSpacing={12}
            size="xl"
            isInvalid={Boolean(error)}
            returnKeyType="go"
            onSubmitEditing={validate}
          />

          {error ? <InlineAlert tone="danger" message={error} /> : null}
        </VStack>
      </KeyboardAwareForm>

      <BottomBar>
        <PrimaryButton onPress={validate} loading={submitting} disabled={submitting}>
          {submitting ? 'Validando...' : 'Confirmar y arrancar'}
        </PrimaryButton>
      </BottomBar>
    </ScreenShell>
  );
}
