import { useFocusEffect, useRouter } from 'expo-router';
import {
  Bell,
  CreditCard,
  Headset,
  MapPin,
  Pencil,
  ShieldCheck,
  SignOut,
  UserCircle,
} from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { Alert, ScrollView } from 'react-native';

import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { HeaderSkeleton } from '@/components/ui-app/header-skeleton';
import { ListRow } from '@/components/ui-app/list-row';
import { ListRowSkeleton } from '@/components/ui-app/list-row-skeleton';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { api } from '@/lib/api/client';
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

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, reload } = useSession();
  const [loading, setLoading] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      await api.get<ProfileResponse>('/v1/mobile/profile');
      await reload();
    } catch {
      void 0;
    } finally {
      setLoading(false);
    }
  }, [reload]);

  useFocusEffect(
    useCallback(() => {
      void fetchProfile();
    }, [fetchProfile]),
  );

  function confirmLogout() {
    Alert.alert(
      'Cerrar sesión',
      '¿Seguro que quieres salir de tu cuenta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, salir',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ],
      { cancelable: true },
    );
  }

  if (!user && loading) {
    return (
      <ScreenShell applyBottomInset={false}>
        <Box className="px-5 pt-2 pb-4">
          <Heading className="text-xl font-bold text-foreground">Mi cuenta</Heading>
        </Box>
        <HeaderSkeleton withAvatar />
        <VStack className="px-5 mt-4 gap-2">
          <ListRowSkeleton showLeading />
          <ListRowSkeleton showLeading />
          <ListRowSkeleton showLeading />
          <ListRowSkeleton showLeading />
        </VStack>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell applyBottomInset={false}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <Box className="px-5 pt-2 pb-4">
          <Heading className="text-xl font-bold text-foreground">Mi cuenta</Heading>
        </Box>

        <Box className="px-5 pb-5">
          <HStack className="bg-card border border-border rounded-2xl p-4 gap-3 items-center">
            <Box className="w-14 h-14 rounded-xl bg-primary-soft items-center justify-center">
              <Text className="text-lg font-bold text-primary-strong">
                {initialsFromName(user?.nombre, user?.apellidos)}
              </Text>
            </Box>
            <VStack className="flex-1">
              <Text className="text-base font-bold text-foreground">
                {user ? `${user.nombre} ${user.apellidos}` : 'Cargando...'}
              </Text>
              <Text className="text-sm text-foreground-secondary" numberOfLines={1}>
                {user?.email ?? ''}
              </Text>
              {user?.telefono ? (
                <Text className="text-xs text-foreground-secondary mt-0.5">{user.telefono}</Text>
              ) : null}
            </VStack>
            <Pressable
              onPress={() => router.push('/profile-edit')}
              hitSlop={8}
              className="w-10 h-10 rounded-lg bg-muted items-center justify-center"
            >
              <Pencil size={18} color={palette.textPrimary} />
            </Pressable>
          </HStack>
        </Box>

        <Box className="px-5 mb-2">
          <Text className="text-xs font-bold uppercase tracking-wide text-foreground-secondary">
            Tu información
          </Text>
        </Box>
        <VStack className="px-5 gap-2">
          <ListRow
            icon={<UserCircle size={20} color={palette.textPrimary} weight="regular" />}
            title="Datos personales"
            description="Nombre, apellidos y teléfono"
            onPress={() => router.push('/profile-edit')}
          />
          <ListRow
            icon={<MapPin size={20} color={palette.textPrimary} weight="regular" />}
            title="Mis direcciones"
            description="Casa, oficina y otras"
            onPress={() => router.push('/(tabs)/addresses')}
          />
          <ListRow
            icon={<CreditCard size={20} color={palette.textDisabled} weight="regular" />}
            title="Métodos de pago"
            description="Próximamente"
          />
        </VStack>

        <Box className="px-5 mt-6 mb-2">
          <Text className="text-xs font-bold uppercase tracking-wide text-foreground-secondary">
            Cuenta
          </Text>
        </Box>
        <VStack className="px-5 gap-2">
          <ListRow
            icon={<Bell size={20} color={palette.textPrimary} weight="regular" />}
            title="Notificaciones"
            description="Revisa los avisos recientes"
            onPress={() => router.push('/notifications')}
          />
          <ListRow
            icon={<ShieldCheck size={20} color={palette.textDisabled} weight="regular" />}
            title="Privacidad y seguridad"
            description="Próximamente"
          />
          <ListRow
            icon={<Headset size={20} color={palette.textPrimary} weight="regular" />}
            title="Ayuda y soporte"
            description="Habla con nosotros"
            onPress={() => router.push('/support')}
          />
        </VStack>

        <Box className="px-5 mt-8">
          <ListRow
            icon={<SignOut size={20} color={palette.danger} weight="regular" />}
            title="Cerrar sesión"
            destructive
            onPress={confirmLogout}
          />
        </Box>

        <Box className="px-5 mt-6">
          <Text className="text-xs text-foreground-secondary text-center">ExpressMX · v1.0</Text>
        </Box>
      </ScrollView>
    </ScreenShell>
  );
}
