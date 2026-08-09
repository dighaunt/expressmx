import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { LogoExpressMX } from '@/components/brand/logo-expressmx';
import { FormField } from '@/components/ui-app/form-field';
import { InlineAlert } from '@/components/ui-app/inline-alert';
import { KeyboardAwareForm } from '@/components/ui-app/keyboard-aware-form';
import { PrimaryButton } from '@/components/ui-app/primary-button';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { apiBaseUrl as BASE_URL } from '@/lib/api/client';
import { login as loginSession } from '@/lib/auth/session';
import { ensureNotificationsSetup } from '@/lib/notifications';
import { connectProviderRealtime } from '@/lib/realtime';

async function postResend(email: string): Promise<{ status: number; message?: string }> {
  const res = await fetch(`${BASE_URL}/v1/mobile/resend-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (res.ok) return { status: res.status };
  const payload = await res.json().catch(() => null);
  const message =
    typeof payload?.error === 'object' && payload?.error
      ? (payload.error.message as string | undefined)
      : (payload?.error as string | undefined);
  return { status: res.status, message };
}

export default function ProviderVerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; password?: string }>();
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
        const result = await postResend(email);
        if (result.status === 429) return;
        if (result.status >= 400) {
          setError(result.message ?? 'No pudimos enviar el código.');
          return;
        }
        setInfo(`Te enviamos un código de 6 dígitos a ${email}.`);
      } catch {
        setError('Error de conexión. Inténtalo en un momento.');
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
      const res = await fetch(`${BASE_URL}/v1/mobile/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, codigo }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          typeof payload?.error === 'object' && payload?.error
            ? (payload.error.message as string | undefined)
            : (payload?.error as string | undefined);
        setError(msg ?? 'Código incorrecto. Inténtalo de nuevo.');
        return;
      }
      if (password) {
        const user = await loginSession(email, password);
        ensureNotificationsSetup().catch(() => null);
        connectProviderRealtime(user).catch(() => null);
        router.replace('/(tabs)/home');
      } else {
        router.replace('/(auth)/login');
      }
    } catch {
      setError('Error de conexión. Inténtalo en un momento.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setError(null);
    setInfo(null);
    setResending(true);
    try {
      const result = await postResend(email);
      if (result.status >= 400) {
        setError(result.message ?? 'No pudimos reenviar el código.');
        return;
      }
      setInfo('Te enviamos un código nuevo. Revisa tu correo.');
    } catch {
      setError('Error de conexión. Inténtalo en un momento.');
    } finally {
      setResending(false);
    }
  }

  return (
    <ScreenShell>
      <KeyboardAwareForm
        contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 32 }}
      >
        <Box className="items-center mb-8">
          <LogoExpressMX width={160} />
        </Box>

        <VStack className="gap-4">
          <Box>
            <Text className="text-xl font-semibold text-foreground">Confirma tu correo</Text>
            <Text className="text-sm text-foreground-secondary mt-1">
              Te enviamos un código de 6 dígitos a {email}.
            </Text>
          </Box>

          {error ? <InlineAlert tone="danger" message={error} /> : null}
          {info ? <InlineAlert tone="info" message={info} /> : null}

          <FormField
            label="Código de 6 dígitos"
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
            <Text className="text-sm text-foreground-secondary">¿No te llegó el código?</Text>
            <Pressable onPress={handleResend} disabled={resending} hitSlop={8}>
              <Text className="text-sm font-bold text-primary">
                {resending ? 'Enviando...' : 'Reenviar'}
              </Text>
            </Pressable>
          </HStack>

          <HStack className="justify-center items-center mt-1 gap-1">
            <Pressable onPress={() => router.replace('/(auth)/login')} hitSlop={8}>
              <Text className="text-xs text-foreground-secondary underline">
                Cambiar de cuenta
              </Text>
            </Pressable>
          </HStack>
        </VStack>
      </KeyboardAwareForm>
    </ScreenShell>
  );
}
