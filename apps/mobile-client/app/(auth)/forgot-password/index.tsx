import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { FormField } from '@/components/ui-app/form-field';
import { InlineAlert } from '@/components/ui-app/inline-alert';
import { KeyboardAwareForm } from '@/components/ui-app/keyboard-aware-form';
import { PrimaryButton } from '@/components/ui-app/primary-button';
import { ScreenHeader } from '@/components/ui-app/screen-header';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { api, ApiError } from '@/lib/api/client';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [global, setGlobal] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!email.trim()) {
      setError('Escribe el correo con el que abriste tu cuenta.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Ese correo no parece válido.');
      return;
    }
    setError(null);
    setGlobal(null);
    setSubmitting(true);
    try {
      await api.post('/v1/auth/forgot-password', { email: email.trim() });
      setSuccess(true);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'No pudimos enviar el enlace. Inténtalo más tarde.';
      setGlobal(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenShell>
      <ScreenHeader
        title="Recuperar contraseña"
        subtitle="Te enviaremos un correo para restablecerla."
      />
      <KeyboardAwareForm contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
        <VStack className="gap-4">
          {success ? (
            <InlineAlert
              tone="success"
              title="Correo enviado"
              message="Revisa tu bandeja de entrada y sigue las instrucciones para crear una contraseña nueva."
            />
          ) : null}
          {global ? <InlineAlert tone="danger" message={global} /> : null}

          <Text className="text-sm text-foreground-secondary">
            Escribe el correo con el que abriste tu cuenta. Si lo encontramos, te llegará un enlace
            para crear una nueva contraseña.
          </Text>

          <FormField
            label="Correo electrónico"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              if (error) setError(null);
            }}
            placeholder="tucorreo@ejemplo.com"
            type="email"
            autoComplete="email"
            textContentType="emailAddress"
            error={error}
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />

          <PrimaryButton onPress={handleSubmit} loading={submitting} disabled={success}>
            {submitting ? 'Enviando...' : success ? 'Enlace enviado' : 'Enviar enlace de recuperación'}
          </PrimaryButton>

          {success ? (
            <PrimaryButton variant="ghost" onPress={() => router.replace('/(auth)/login')}>
              Volver al inicio de sesión
            </PrimaryButton>
          ) : null}
        </VStack>
      </KeyboardAwareForm>
    </ScreenShell>
  );
}
