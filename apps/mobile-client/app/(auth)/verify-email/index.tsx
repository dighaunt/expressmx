import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Box } from '@/components/ui/box';
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
import { api, ApiError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/use-session';

interface VerifyResponse {
  data: { token: string };
}

export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; password?: string }>();
  const { login } = useSession();
  const email = (params.email ?? '').toString();
  const password = (params.password ?? '').toString();

  const [codigo, setCodigo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const autoSentRef = useRef(false);

  useEffect(() => {
    if (autoSentRef.current || !email) return;
    autoSentRef.current = true;
    void (async () => {
      try {
        await api.post('/v1/mobile/resend-verification', { email });
        setInfo(`Te enviamos un código de 6 dígitos a ${email}.`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 429) return;
        const message =
          err instanceof ApiError ? err.message : 'No pudimos enviar el código.';
        setError(message);
      }
    })();
  }, [email]);

  async function handleVerify() {
    setError(null);
    setInfo(null);
    if (!/^[0-9]{6}$/.test(codigo)) {
      setError('Ingresa los 6 dígitos del código que recibiste por correo.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post<VerifyResponse>('/v1/mobile/verify-email', { email, codigo });
      if (password) {
        await login(email, password);
        router.replace('/(tabs)/home');
      } else {
        router.replace('/(auth)/login');
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'No pudimos verificar tu código. Inténtalo de nuevo.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setError(null);
    setInfo(null);
    setResending(true);
    try {
      await api.post('/v1/mobile/resend-verification', { email });
      setInfo('Te enviamos un código nuevo. Revisa tu correo.');
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'No pudimos reenviar el código. Espera un momento.';
      setError(message);
    } finally {
      setResending(false);
    }
  }

  return (
    <ScreenShell>
      <ScreenHeader
        title="Confirma tu correo"
        subtitle={`Te enviamos un código de 6 dígitos a ${email}.`}
      />
      <KeyboardAwareForm contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
        <VStack className="gap-4">
          {error ? <InlineAlert tone="danger" message={error} /> : null}
          {info ? <InlineAlert tone="info" message={info} /> : null}

          <Box className="bg-primary-soft rounded-xl p-4">
            <Text className="text-sm font-semibold text-primary-strong">
              Código de verificación
            </Text>
            <Text className="text-xs text-foreground-secondary mt-0.5">
              El código vence en 15 minutos. Si no llega, revisa tu carpeta de spam.
            </Text>
          </Box>

          <FormField
            label="Código"
            value={codigo}
            onChangeText={(v) => setCodigo(v.replace(/[^0-9]/g, '').slice(0, 6))}
            placeholder="123456"
            type="numeric"
            maxLength={6}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            returnKeyType="go"
            onSubmitEditing={handleVerify}
          />

          <PrimaryButton onPress={handleVerify} loading={submitting}>
            {submitting ? 'Verificando...' : 'Verificar y entrar'}
          </PrimaryButton>

          <HStack className="justify-center items-center mt-2 gap-1">
            <Text className="text-sm text-foreground-secondary">¿No recibiste el código?</Text>
            <Pressable onPress={handleResend} disabled={resending} hitSlop={8}>
              <Text className="text-sm font-bold text-primary">
                {resending ? 'Enviando...' : 'Reenviar'}
              </Text>
            </Pressable>
          </HStack>

          <HStack className="justify-center items-center mt-1 gap-1">
            <Pressable onPress={() => router.replace('/(auth)/login')} hitSlop={8}>
              <Text className="text-xs text-foreground-secondary underline">Cambiar de cuenta</Text>
            </Pressable>
          </HStack>
        </VStack>
      </KeyboardAwareForm>
    </ScreenShell>
  );
}
