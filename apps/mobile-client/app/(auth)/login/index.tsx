import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ShieldCheck, LightningA } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { LogoExpressMX } from '@/components/brand/logo-expressmx';
import { AnimatedGradientBackdrop } from '@/components/ui-app/animated-gradient-backdrop';
import { FormField } from '@/components/ui-app/form-field';
import { InlineAlert } from '@/components/ui-app/inline-alert';
import { KeyboardDismissChip } from '@/components/ui-app/keyboard-dismiss-chip';
import { PrimaryButton } from '@/components/ui-app/primary-button';
import { ApiError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/use-session';
import { palette } from '@/lib/theme/tokens';

interface FormErrors {
  email?: string;
  password?: string;
  global?: string;
}

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  function validate(): FormErrors {
    const next: FormErrors = {};
    if (!email.trim()) next.email = 'Escribe tu correo electrónico.';
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = 'Ese correo no se ve bien, revísalo.';
    if (!password) next.password = 'Falta tu contraseña.';
    return next;
  }

  async function handleSubmit() {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)/home');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') {
        router.push({
          pathname: '/(auth)/verify-email',
          params: { email: email.trim(), password },
        });
        return;
      }
      const message = err instanceof ApiError ? err.message : 'No pudimos iniciar tu sesión.';
      setErrors({ global: message });
    } finally {
      setSubmitting(false);
    }
  }

  const heroHeight = insets.top + 240;
  const cardOverlap = 36;

  return (
    <Box className="flex-1" style={{ backgroundColor: '#0B1E5C' }}>
      <StatusBar style="light" translucent backgroundColor="transparent" />

      <AnimatedGradientBackdrop height={heroHeight} />

      <Box
        className="absolute left-0 right-0 top-0"
        style={{ height: heroHeight }}
        pointerEvents="box-none"
      >
        <VStack className="px-6 gap-3" style={{ paddingTop: insets.top + 24 }}>
          <HStack className="items-center gap-2">
            <Box className="bg-white/15 rounded-full p-2">
              <LightningA size={18} color="#FFFFFF" weight="fill" />
            </Box>
            <LogoExpressMX width={140} />
          </HStack>

          <VStack className="gap-1 mt-2">
            <Heading className="text-white font-bold" size="2xl">
              Hola de nuevo
            </Heading>
            <Text className="text-primary-soft text-base">
              Entra para seguir tus servicios y pagos.
            </Text>
          </VStack>
        </VStack>
      </Box>

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: 'transparent' }}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
      >
        <ScrollView
          style={{ flex: 1, backgroundColor: 'transparent' }}
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: heroHeight - cardOverlap,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
        >
          <Box
            className="bg-background rounded-t-3xl px-6 pt-8 flex-1"
            style={{
              paddingBottom: insets.bottom + 24,
              shadowColor: palette.shadow,
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.08,
              shadowRadius: 16,
              elevation: 6,
            }}
          >
            <VStack className="gap-1 mb-6">
              <Heading className="text-foreground font-bold" size="xl">
                Inicia sesión
              </Heading>
              <Text className="text-foreground-secondary text-sm">
                Usa el correo con el que te registraste.
              </Text>
            </VStack>

            <VStack className="gap-4">
              {errors.global ? <InlineAlert tone="danger" message={errors.global} /> : null}

              <FormField
                label="Correo electrónico"
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                }}
                placeholder="tucorreo@ejemplo.com"
                type="email"
                autoComplete="email"
                textContentType="emailAddress"
                error={errors.email}
                returnKeyType="next"
              />

              <FormField
                label="Contraseña"
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                }}
                placeholder="Tu contraseña"
                type="password"
                autoComplete="password"
                textContentType="password"
                error={errors.password}
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
              />

              <HStack className="justify-end">
                <Pressable onPress={() => router.push('/(auth)/forgot-password')} hitSlop={8}>
                  <Text className="text-sm font-semibold text-primary">¿Olvidaste tu contraseña?</Text>
                </Pressable>
              </HStack>

              <PrimaryButton onPress={handleSubmit} loading={submitting}>
                {submitting ? 'Entrando...' : 'Iniciar sesión'}
              </PrimaryButton>

              <HStack className="items-center gap-2 mt-1">
                <ShieldCheck size={16} color={palette.textTertiary} weight="duotone" />
                <Text className="text-xs text-foreground-secondary flex-1">
                  Tu información viaja cifrada. Nunca compartimos tus datos.
                </Text>
              </HStack>
            </VStack>

            <Box className="flex-1" />

            <Box className="h-px bg-border my-6" />

            <HStack className="justify-center items-center gap-1">
              <Text className="text-sm text-foreground-secondary">¿Eres nuevo en ExpressMX?</Text>
              <Pressable onPress={() => router.push('/(auth)/register')} hitSlop={8}>
                <Text className="text-sm font-bold text-primary">Crea tu cuenta</Text>
              </Pressable>
            </HStack>
          </Box>
        </ScrollView>
      </KeyboardAvoidingView>

      <KeyboardDismissChip />
    </Box>
  );
}
