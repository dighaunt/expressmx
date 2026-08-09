import { useRouter } from 'expo-router';
import { X } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { BottomBar } from '@/components/ui-app/bottom-bar';
import { FormField } from '@/components/ui-app/form-field';
import { InlineAlert } from '@/components/ui-app/inline-alert';
import { KeyboardAwareForm } from '@/components/ui-app/keyboard-aware-form';
import { PrimaryButton } from '@/components/ui-app/primary-button';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { api, ApiError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/use-session';
import { initialsFromName } from '@/lib/format';
import { palette } from '@/lib/theme/tokens';

interface ProfileResponse {
  data: {
    id: string;
    nombre: string;
    apellidos: string;
    email: string;
    telefono: string | null;
    avatar_url: string | null;
    rol: string;
  };
}

interface FormErrors {
  nombre?: string;
  apellidos?: string;
  telefono?: string;
  global?: string;
}

export default function ProfileEditScreen() {
  const router = useRouter();
  const { user, reload } = useSession();
  const [form, setForm] = useState({ nombre: '', apellidos: '', telefono: '' });
  const [initial, setInitial] = useState({ nombre: '', apellidos: '', telefono: '' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<ProfileResponse>('/v1/mobile/profile')
      .then((response) => {
        if (cancelled) return;
        const next = {
          nombre: response.data.nombre ?? '',
          apellidos: response.data.apellidos ?? '',
          telefono: response.data.telefono ?? '',
        };
        setForm(next);
        setInitial(next);
      })
      .catch(() => {
        if (cancelled) return;
        if (user) {
          const next = {
            nombre: user.nombre ?? '',
            apellidos: user.apellidos ?? '',
            telefono: user.telefono ?? '',
          };
          setForm(next);
          setInitial(next);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const isDirty =
    form.nombre.trim() !== initial.nombre.trim() ||
    form.apellidos.trim() !== initial.apellidos.trim() ||
    form.telefono.trim() !== (initial.telefono ?? '').trim();

  function close() {
    router.back();
  }

  function discardAndClose() {
    router.back();
  }

  function validate(): FormErrors {
    const next: FormErrors = {};
    if (!form.nombre.trim()) next.nombre = 'Tu nombre no puede quedar vacío.';
    if (!form.apellidos.trim()) next.apellidos = 'Falta tu apellido.';
    if (form.telefono && !/^\+?[0-9]{8,15}$/.test(form.telefono.trim())) {
      next.telefono = 'Usa solo números, sin espacios. Ejemplo: 5512345678.';
    }
    return next;
  }

  async function handleSave() {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSubmitting(true);
    try {
      await api.patch<ProfileResponse>('/v1/mobile/profile', {
        nombre: form.nombre.trim(),
        apellidos: form.apellidos.trim(),
        telefono: form.telefono.trim() || null,
      });
      await reload();
      setInitial({ ...form });
      setSavedToast(true);
      setTimeout(() => router.back(), 600);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'No pudimos guardar tus datos.';
      setErrors({ global: message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenShell applyBottomInset={false}>
      <Box className="bg-background px-5 pt-2 pb-4 border-b border-border">
        <HStack className="items-center gap-3">
          <Pressable
            onPress={close}
            hitSlop={12}
            disabled={isDirty}
            className={`w-10 h-10 rounded-xl items-center justify-center ${isDirty ? 'bg-muted opacity-40' : 'bg-muted'}`}
          >
            <X size={20} color={palette.textPrimary} weight="bold" />
          </Pressable>
          <VStack className="flex-1">
            <Heading className="text-lg font-bold text-foreground">Editar perfil</Heading>
            <Text className="text-sm text-foreground-secondary">
              Actualiza tus datos personales.
            </Text>
          </VStack>
        </HStack>
      </Box>
      {isDirty ? (
        <Box className="px-5 pt-3">
          <InlineAlert
            tone="warning"
            title="Tienes cambios sin guardar"
            message="Guarda para conservar tus cambios o usa Descartar para salir sin guardar."
          />
        </Box>
      ) : null}

      <KeyboardAwareForm
        contentContainerStyle={{ padding: 24, paddingBottom: 24 }}
        footer={
          <BottomBar>
            <HStack className="gap-2">
              <Box className="flex-1">
                <PrimaryButton variant="ghost" onPress={isDirty ? discardAndClose : close}>
                  {isDirty ? 'Descartar' : 'Cancelar'}
                </PrimaryButton>
              </Box>
              <Box className="flex-1">
                <PrimaryButton
                  onPress={handleSave}
                  loading={submitting}
                  disabled={!isDirty || loading}
                >
                  {submitting ? 'Guardando...' : savedToast ? 'Guardado' : 'Guardar'}
                </PrimaryButton>
              </Box>
            </HStack>
          </BottomBar>
        }
      >
        {loading ? (
          <Box className="py-10 items-center">
            <Spinner color={palette.brand} />
          </Box>
        ) : (
          <VStack className="gap-4">
            <VStack className="items-center gap-2 mt-1">
              <Box className="w-20 h-20 rounded-2xl bg-primary-soft items-center justify-center">
                <Text className="text-2xl font-bold text-primary-strong">
                  {initialsFromName(form.nombre, form.apellidos)}
                </Text>
              </Box>
              <Text className="text-sm text-foreground-secondary">{user?.email ?? ''}</Text>
            </VStack>

            {errors.global ? <InlineAlert tone="danger" message={errors.global} /> : null}
            {savedToast ? (
              <InlineAlert tone="success" message="Listo, tus cambios se guardaron." />
            ) : null}

            <FormField
              label="Nombre"
              value={form.nombre}
              onChangeText={(v) => {
                setForm((prev) => ({ ...prev, nombre: v }));
                if (errors.nombre) setErrors((prev) => ({ ...prev, nombre: undefined }));
              }}
              placeholder="Sofía"
              autoCapitalize="words"
              error={errors.nombre}
            />

            <FormField
              label="Apellidos"
              value={form.apellidos}
              onChangeText={(v) => {
                setForm((prev) => ({ ...prev, apellidos: v }));
                if (errors.apellidos) setErrors((prev) => ({ ...prev, apellidos: undefined }));
              }}
              placeholder="Ramírez Olvera"
              autoCapitalize="words"
              error={errors.apellidos}
            />

            <FormField
              label="Teléfono"
              value={form.telefono}
              onChangeText={(v) => {
                setForm((prev) => ({ ...prev, telefono: v }));
                if (errors.telefono) setErrors((prev) => ({ ...prev, telefono: undefined }));
              }}
              placeholder="55 1234 5678"
              type="phone"
              error={errors.telefono}
              helper="Lo usamos solo si necesitamos llamarte por tu pedido."
              maxLength={15}
            />

            <Box className="bg-muted rounded-xl p-4">
              <Text className="text-xs uppercase tracking-wide text-foreground-secondary">
                Correo
              </Text>
              <Text className="text-sm font-semibold text-foreground mt-1">
                {user?.email ?? '—'}
              </Text>
              <Text className="text-xs text-foreground-secondary mt-0.5">
                El correo está vinculado a tu cuenta. Si necesitas cambiarlo, escríbele a soporte.
              </Text>
            </Box>
          </VStack>
        )}
      </KeyboardAwareForm>
    </ScreenShell>
  );
}
