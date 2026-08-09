import { useRouter } from 'expo-router';
import { useState } from 'react';
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

interface FormErrors {
  nombre?: string;
  apellidos?: string;
  email?: string;
  telefono?: string;
  password?: string;
  global?: string;
}

interface RegisterResponse {
  data: { id: string; email: string; pendiente_verificacion: boolean };
}

export default function RegisterScreen() {
  const router = useRouter();
  const [form, setForm] = useState({
    nombre: '',
    apellidos: '',
    email: '',
    telefono: '',
    password: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate(): FormErrors {
    const next: FormErrors = {};
    if (!form.nombre.trim()) next.nombre = 'Tu nombre nos ayuda a ubicarte.';
    if (!form.apellidos.trim()) next.apellidos = 'Falta tu apellido.';
    if (!form.email.trim()) next.email = 'Escribe tu correo electrónico.';
    else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = 'Ese correo no parece válido.';
    if (form.telefono && !/^\+?[0-9]{8,15}$/.test(form.telefono.trim())) {
      next.telefono = 'Usa solo números, sin espacios. Ejemplo: 5512345678';
    }
    if (form.password.length < 8) next.password = 'La contraseña necesita al menos 8 caracteres.';
    return next;
  }

  async function handleSubmit() {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSubmitting(true);
    try {
      const email = form.email.trim();
      await api.post<RegisterResponse>('/v1/mobile/register', {
        nombre: form.nombre.trim(),
        apellidos: form.apellidos.trim(),
        email,
        telefono: form.telefono.trim() || undefined,
        password: form.password,
        rol: 'cliente',
      });
      router.replace({
        pathname: '/(auth)/verify-email',
        params: { email, password: form.password },
      });
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'No pudimos crear tu cuenta. Inténtalo en un momento.';
      setErrors({ global: message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenShell>
      <ScreenHeader title="Crea tu cuenta" subtitle="Te toma menos de un minuto." />
      <KeyboardAwareForm contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
        <VStack className="gap-4">
          {errors.global ? <InlineAlert tone="danger" message={errors.global} /> : null}

          <Box className="bg-primary-soft rounded-xl p-4">
            <Text className="text-sm font-semibold text-primary-strong">Datos personales</Text>
            <Text className="text-xs text-foreground-secondary mt-0.5">
              Los necesitamos para asignarte servicios y contactarte.
            </Text>
          </Box>

          <FormField
            label="Nombre"
            value={form.nombre}
            onChangeText={(v) => update('nombre', v)}
            placeholder="Sofía"
            autoCapitalize="words"
            autoComplete="name-given"
            textContentType="givenName"
            error={errors.nombre}
            returnKeyType="next"
          />

          <FormField
            label="Apellidos"
            value={form.apellidos}
            onChangeText={(v) => update('apellidos', v)}
            placeholder="Ramírez Olvera"
            autoCapitalize="words"
            autoComplete="name-family"
            textContentType="familyName"
            error={errors.apellidos}
            returnKeyType="next"
          />

          <FormField
            label="Correo electrónico"
            value={form.email}
            onChangeText={(v) => update('email', v)}
            placeholder="tucorreo@ejemplo.com"
            type="email"
            autoComplete="email"
            textContentType="emailAddress"
            error={errors.email}
            returnKeyType="next"
          />

          <FormField
            label="Teléfono (opcional)"
            value={form.telefono}
            onChangeText={(v) => update('telefono', v)}
            placeholder="55 1234 5678"
            type="phone"
            autoComplete="tel"
            textContentType="telephoneNumber"
            error={errors.telefono}
            helper="Lo usamos para llamarte si hay algún cambio en tu pedido."
            maxLength={15}
            returnKeyType="next"
          />

          <FormField
            label="Contraseña"
            value={form.password}
            onChangeText={(v) => update('password', v)}
            placeholder="Mínimo 8 caracteres"
            type="password"
            autoComplete="password-new"
            textContentType="newPassword"
            error={errors.password}
            helper="Combina letras y números para que sea más segura."
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />

          <PrimaryButton onPress={handleSubmit} loading={submitting}>
            {submitting ? 'Creando tu cuenta...' : 'Crear mi cuenta'}
          </PrimaryButton>

          <Text className="text-xs text-foreground-secondary text-center">
            Al registrarte aceptas nuestros términos y la política de privacidad.
          </Text>

          <HStack className="justify-center items-center mt-2 gap-1">
            <Text className="text-sm text-foreground-secondary">¿Ya tienes cuenta?</Text>
            <Pressable onPress={() => router.replace('/(auth)/login')} hitSlop={8}>
              <Text className="text-sm font-bold text-primary">Inicia sesión</Text>
            </Pressable>
          </HStack>
        </VStack>
      </KeyboardAwareForm>
    </ScreenShell>
  );
}
