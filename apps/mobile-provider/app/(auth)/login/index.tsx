import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Box } from '@/components/ui/box';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { LogoExpressMX } from '@/components/brand/logo-expressmx';
import { FormField } from '@/components/ui-app/form-field';
import { InlineAlert } from '@/components/ui-app/inline-alert';
import { KeyboardAwareForm } from '@/components/ui-app/keyboard-aware-form';
import { PrimaryButton } from '@/components/ui-app/primary-button';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { login } from '@/lib/auth/session';
import { ensureNotificationsSetup } from '@/lib/notifications';
import { connectProviderRealtime } from '@/lib/realtime';

export default function ProviderLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  function validate(): boolean {
    let ok = true;
    setEmailError(null);
    setPasswordError(null);

    if (!email.trim()) {
      setEmailError('Tu correo es necesario para entrar');
      ok = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError('Revisa que el correo esté escrito correctamente');
      ok = false;
    }
    if (!password) {
      setPasswordError('Tu contraseña no puede ir vacía');
      ok = false;
    }
    return ok;
  }

  async function handleLogin() {
    if (!validate()) return;
    setGlobalError(null);
    setSubmitting(true);
    try {
      const user = await login(email.trim(), password);
      if (user.rol !== 'prestador') {
        setGlobalError('Esta app es exclusiva para prestadores. Usa la app del cliente.');
        return;
      }
      ensureNotificationsSetup().catch(() => null);
      connectProviderRealtime(user).catch(() => null);
      router.replace('/(tabs)/home');
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'EMAIL_NOT_VERIFIED') {
        router.push({
          pathname: '/(auth)/verify-email',
          params: { email: email.trim(), password },
        });
        return;
      }
      const message = err instanceof Error ? err.message : 'No pudimos iniciarte la sesión';
      setGlobalError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenShell>
      <KeyboardAwareForm
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingVertical: 32,
        }}
      >
        <Box className="items-center mb-10">
          <LogoExpressMX width={200} />
        </Box>

        <VStack className="gap-4">
          {globalError ? <InlineAlert tone="danger" message={globalError} /> : null}

          <FormField
            label="Correo electrónico"
            value={email}
            onChangeText={setEmail}
            placeholder="tu@correo.com"
            type="email"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            error={emailError}
          />

          <FormField
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            placeholder="Tu contraseña"
            type="password"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={handleLogin}
            error={passwordError}
          />

          <Box className="mt-2">
            <PrimaryButton onPress={handleLogin} loading={submitting} disabled={submitting}>
              {submitting ? 'Entrando...' : 'Iniciar sesión'}
            </PrimaryButton>
          </Box>

          <Pressable
            onPress={() => router.push('/(auth)/register')}
            className="self-center mt-1"
            hitSlop={8}
          >
            <Text className="text-sm text-foreground-secondary text-center">
              ¿Eres nuevo en el equipo?{' '}
              <Text className="text-sm font-semibold text-primary">
                Activa tu cuenta con el código de RRHH
              </Text>
            </Text>
          </Pressable>
        </VStack>
      </KeyboardAwareForm>
    </ScreenShell>
  );
}
