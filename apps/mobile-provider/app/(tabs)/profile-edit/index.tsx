import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { BottomBar } from '@/components/ui-app/bottom-bar';
import { FormField } from '@/components/ui-app/form-field';
import { InlineAlert } from '@/components/ui-app/inline-alert';
import { KeyboardAwareForm } from '@/components/ui-app/keyboard-aware-form';
import { PrimaryButton } from '@/components/ui-app/primary-button';
import { ScreenHeader } from '@/components/ui-app/screen-header';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { api, ApiError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/use-session';

interface ProfileResponse {
  data: {
    nombre: string;
    apellidos: string;
    telefono: string | null;
    email: string;
  };
}

export default function ProfileEditScreen() {
  const router = useRouter();
  const { user, reload } = useSession();
  const [nombre, setNombre] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await api.get<ProfileResponse>('/v1/mobile/profile');
        if (cancelled) return;
        setNombre(response.data.nombre);
        setApellidos(response.data.apellidos);
        setTelefono(response.data.telefono ?? '');
        setEmail(response.data.email);
      } catch {
        if (cancelled) return;
        if (user) {
          setNombre(user.nombre);
          setApellidos(user.apellidos);
          setEmail(user.email);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  function validate(): boolean {
    const next: Record<string, string | null> = {};
    if (!nombre.trim()) next.nombre = 'No te puedes quedar sin nombre.';
    if (!apellidos.trim()) next.apellidos = 'Apellidos también, por favor.';
    if (telefono.trim() && !/^\+?[0-9\s-]{8,15}$/.test(telefono.trim())) {
      next.telefono = 'El teléfono no se ve bien. Revísalo.';
    }
    setErrors(next);
    return Object.values(next).every((v) => !v);
  }

  async function save() {
    if (!validate()) return;
    setGlobalError(null);
    setSubmitting(true);
    try {
      await api.patch('/v1/mobile/profile', {
        nombre: nombre.trim(),
        apellidos: apellidos.trim(),
        telefono: telefono.trim() || null,
      });
      await reload();
      router.back();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'No pudimos guardar tus datos.';
      setGlobalError(message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleEmailChange() {
    Alert.alert(
      'Cambiar correo',
      'Por seguridad, solo RRHH puede cambiar tu correo. Si necesitas modificarlo, escríbenos por soporte.',
    );
  }

  return (
    <ScreenShell>
      <ScreenHeader title="Datos personales" subtitle="Actualiza tu información" />
      <KeyboardAwareForm
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 20, paddingBottom: 100 }}
      >
        <VStack className="gap-4">
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
            label="Teléfono"
            value={telefono}
            onChangeText={setTelefono}
            placeholder="+52 555 000 0000"
            type="phone"
            textContentType="telephoneNumber"
            returnKeyType="done"
            error={errors.telefono}
          />

          <Box>
            <FormField
              label="Correo"
              value={email}
              onChangeText={() => {}}
              placeholder=""
              type="email"
              helper="El correo lo gestiona RRHH. Tócalo para más información."
            />
            <Box
              className="absolute inset-0"
              style={{ backgroundColor: 'transparent' }}
              onTouchEnd={handleEmailChange}
            />
          </Box>
        </VStack>
      </KeyboardAwareForm>

      <BottomBar>
        <PrimaryButton onPress={save} loading={submitting} disabled={submitting}>
          {submitting ? 'Guardando...' : 'Guardar cambios'}
        </PrimaryButton>
      </BottomBar>
    </ScreenShell>
  );
}
