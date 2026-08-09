import { useRouter } from 'expo-router';
import { CheckCircle, KeyReturn } from 'phosphor-react-native';
import { useState } from 'react';
import { Stepper } from '@/components/stepper';
import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { FormField } from '@/components/ui-app/form-field';
import { InlineAlert } from '@/components/ui-app/inline-alert';
import { KeyboardAwareForm } from '@/components/ui-app/keyboard-aware-form';
import { NumericInput } from '@/components/ui-app/numeric-input';
import { PrimaryButton } from '@/components/ui-app/primary-button';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { apiBaseUrl } from '@/lib/api/client';
import { palette, spacing } from '@/lib/theme/tokens';

const REGISTER_STEPS = [
  { key: 'code', label: 'Código' },
  { key: 'form', label: 'Datos personales' },
] as const;

const BASE_URL = apiBaseUrl;

type Step = 'code' | 'form';

interface CodeStepProps {
  onValid: (codigo: string) => void;
  onCancel: () => void;
}

function CodeStep({ onValid, onCancel }: CodeStepProps) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function validate() {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 6) {
      setError('El código tiene al menos 6 caracteres.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE_URL}/v1/mobile/invitations/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: trimmed }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const apiMessage =
          typeof data?.error === 'object' && data?.error
            ? (data.error.message as string | undefined)
            : (data?.error as string | undefined);
        setError(apiMessage ?? 'No pudimos validar el código.');
        return;
      }
      onValid(trimmed);
    } catch {
      setError('Error de conexión. Verifica tu red.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <VStack className="gap-4">
      <Box className="self-center w-16 h-16 rounded-2xl bg-primary-soft items-center justify-center">
        <KeyReturn size={32} color={palette.brandStrong} weight="duotone" />
      </Box>

      <VStack className="items-center gap-1 px-4">
        <Heading className="text-2xl font-bold text-foreground text-center">
          Código de RRHH
        </Heading>
        <Text className="text-sm text-foreground-secondary text-center">
          Ingresa el código que te dio Recursos Humanos para empezar tu registro
          como prestador.
        </Text>
      </VStack>

      <VStack className="gap-1.5 mt-2">
        <Text className="text-sm font-medium text-foreground-secondary">Código</Text>
        <NumericInput
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          placeholder="ABCD1234"
          keyboardType="default"
          maxLength={32}
          letterSpacing={4}
          size="lg"
          autoCapitalize="characters"
          isInvalid={Boolean(error)}
          returnKeyType="go"
          onSubmitEditing={validate}
        />
        {error ? (
          <Text className="text-xs text-destructive mt-1">{error}</Text>
        ) : (
          <Text className="text-xs text-foreground-secondary mt-1">
            Si no tienes código, contacta a tu supervisor.
          </Text>
        )}
      </VStack>

      <Box className="mt-2">
        <PrimaryButton onPress={validate} loading={submitting} disabled={submitting}>
          {submitting ? 'Validando...' : 'Continuar'}
        </PrimaryButton>
      </Box>

      <Pressable onPress={onCancel} className="self-center mt-1" hitSlop={8}>
        <Text className="text-sm font-semibold text-foreground-secondary">
          Volver al inicio de sesión
        </Text>
      </Pressable>
    </VStack>
  );
}

interface FormStepProps {
  codigo: string;
  onSuccess: (credentials: { email: string; password: string }) => void;
  onBack: () => void;
}

function FormStep({ codigo, onSuccess, onBack }: FormStepProps) {
  const [nombre, setNombre] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  function validate(): boolean {
    const next: Record<string, string | null> = {};
    if (!nombre.trim()) next.nombre = 'Ponemos tu nombre en cada orden — necesitamos que esté.';
    if (!apellidos.trim()) next.apellidos = 'Apellidos también, por favor.';
    if (!email.trim()) {
      next.email = 'Tu correo es la llave para entrar.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = 'Ese correo no se ve bien. Revísalo.';
    }
    if (!password) {
      next.password = 'Pon una contraseña para proteger tu cuenta.';
    } else if (password.length < 8) {
      next.password = 'Mínimo 8 caracteres para que sea segura.';
    }
    setErrors(next);
    return Object.values(next).every((v) => !v);
  }

  async function submit() {
    if (!validate()) return;
    setGlobalError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE_URL}/v1/mobile/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          apellidos: apellidos.trim(),
          email: email.trim(),
          telefono: telefono.trim() || undefined,
          password,
          rol: 'prestador',
          codigo_invitacion: codigo,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const apiMessage =
          typeof data?.error === 'object' && data?.error
            ? (data.error.message as string | undefined)
            : (data?.error as string | undefined);
        setGlobalError(apiMessage ?? 'No pudimos crear tu cuenta.');
        return;
      }
      onSuccess({ email: email.trim(), password });
    } catch {
      setGlobalError('Error de conexión. Inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <VStack className="gap-4">
      <Box className="bg-success-soft rounded-xl px-3 py-2.5 flex-row items-center gap-2">
        <CheckCircle size={20} color={palette.success} weight="fill" />
        <Text className="text-sm text-success font-semibold flex-1">
          Código {codigo} aplicado
        </Text>
      </Box>

      <VStack className="gap-1">
        <Heading className="text-2xl font-bold text-foreground">Tus datos</Heading>
        <Text className="text-sm text-foreground-secondary">
          Solo los necesitamos una vez para crear tu cuenta.
        </Text>
      </VStack>

      {globalError ? <InlineAlert tone="danger" message={globalError} /> : null}

      <FormField
        label="Nombre"
        value={nombre}
        onChangeText={setNombre}
        placeholder="Tu nombre"
        autoCapitalize="words"
        textContentType="givenName"
        returnKeyType="next"
        error={errors.nombre}
      />
      <FormField
        label="Apellidos"
        value={apellidos}
        onChangeText={setApellidos}
        placeholder="Tus apellidos"
        autoCapitalize="words"
        textContentType="familyName"
        returnKeyType="next"
        error={errors.apellidos}
      />
      <FormField
        label="Correo"
        value={email}
        onChangeText={setEmail}
        placeholder="tu@correo.com"
        type="email"
        textContentType="emailAddress"
        returnKeyType="next"
        error={errors.email}
      />
      <FormField
        label="Teléfono (opcional)"
        value={telefono}
        onChangeText={setTelefono}
        placeholder="+52 555 000 0000"
        type="phone"
        textContentType="telephoneNumber"
        returnKeyType="next"
      />
      <FormField
        label="Contraseña"
        value={password}
        onChangeText={setPassword}
        placeholder="Mínimo 8 caracteres"
        type="password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
        helper="Una contraseña con letras y números te servirá."
        error={errors.password}
      />

      <Box className="mt-2">
        <PrimaryButton onPress={submit} loading={submitting} disabled={submitting}>
          {submitting ? 'Registrando...' : 'Crear cuenta'}
        </PrimaryButton>
      </Box>

      <Pressable onPress={onBack} className="self-center mt-1" hitSlop={8}>
        <Text className="text-sm font-semibold text-foreground-secondary">
          Usar otro código
        </Text>
      </Pressable>
    </VStack>
  );
}

export default function ProviderRegisterScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('code');
  const [codigo, setCodigo] = useState('');

  return (
    <ScreenShell>
      <KeyboardAwareForm
        contentContainerStyle={{ paddingHorizontal: spacing.gutterLg, paddingVertical: spacing.bottomSafe }}
      >
        <VStack className="gap-6">
          <Stepper
            steps={[...REGISTER_STEPS]}
            currentStepIndex={step === 'code' ? 0 : 1}
          />
          {step === 'code' ? (
            <CodeStep
              onValid={(c) => {
                setCodigo(c);
                setStep('form');
              }}
              onCancel={() => router.replace('/(auth)/login')}
            />
          ) : (
            <FormStep
              codigo={codigo}
              onSuccess={({ email, password }) =>
                router.replace({
                  pathname: '/(auth)/verify-email',
                  params: { email, password },
                })
              }
              onBack={() => setStep('code')}
            />
          )}
        </VStack>
      </KeyboardAwareForm>
    </ScreenShell>
  );
}
