import { useFocusEffect, useRouter } from 'expo-router';
import {
  Bank,
  CalendarBlank,
  CheckCircle,
  ClipboardText,
  Clock,
  FileText,
  Headset,
  IdentificationCard,
  Pencil,
  SignOut,
  Toolbox,
  WarningCircle,
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
import { palette, spacing } from '@/lib/theme/tokens';

interface ProfileData {
  id: string;
  nombre: string;
  apellidos: string;
  email: string;
  telefono: string | null;
  rol: string;
  servicios_totales: number;
  especialidades: string[];
}

interface ProfileResponse {
  data: ProfileData;
}

interface DocumentRow {
  id: string;
  tipo: 'ine' | 'curp' | 'domicilio' | 'certificacion';
  titulo: string;
  detalle: string;
  estatus: 'pendiente' | 'aprobado' | 'rechazado';
}

interface DocumentsResponse {
  data: DocumentRow[];
}

interface BankAccountData {
  banco_nombre: string;
  clabe_mascara: string;
  estatus: 'pendiente' | 'verificada' | 'rechazada';
}

interface BankAccountResponse {
  data: BankAccountData | null;
}

const DOC_ICONS: Record<DocumentRow['tipo'], React.ReactNode> = {
  ine: <IdentificationCard size={20} color={palette.brandStrong} />,
  curp: <FileText size={20} color={palette.brandStrong} />,
  domicilio: <ClipboardText size={20} color={palette.brandStrong} />,
  certificacion: <FileText size={20} color={palette.brandStrong} />,
};

function StatusGlyph({ estatus }: { estatus: DocumentRow['estatus'] }) {
  if (estatus === 'aprobado') {
    return <CheckCircle size={20} color={palette.success} weight="fill" />;
  }
  if (estatus === 'pendiente') {
    return <Clock size={20} color={palette.warning} weight="fill" />;
  }
  return <WarningCircle size={20} color={palette.danger} weight="fill" />;
}

export default function ProviderProfile() {
  const router = useRouter();
  const { user, logout } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [bankAccount, setBankAccount] = useState<BankAccountData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [p, d, b] = await Promise.all([
        api.get<ProfileResponse>('/v1/mobile/profile').catch(() => null),
        api.get<DocumentsResponse>('/v1/mobile/provider/documents').catch(() => null),
        api.get<BankAccountResponse>('/v1/mobile/provider/bank-account').catch(() => null),
      ]);
      if (p?.data) setProfile(p.data);
      if (d?.data) setDocuments(d.data);
      if (b) setBankAccount(b.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function confirmLogout() {
    Alert.alert(
      'Cerrar sesión',
      '¿Seguro que quieres salir?',
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

  const initials = (
    user
      ? `${user.nombre.charAt(0)}${user.apellidos.charAt(0)}`
      : profile
        ? `${profile.nombre.charAt(0)}${profile.apellidos.charAt(0)}`
        : '··'
  ).toUpperCase();

  if (loading && !profile && !user) {
    return (
      <ScreenShell applyBottomInset={false}>
        <Box className="px-5 pt-2 pb-4">
          <Heading className="text-xl font-bold text-foreground">Perfil</Heading>
        </Box>
        <HeaderSkeleton withAvatar />
        <VStack className="px-5 gap-2 mt-4">
          <ListRowSkeleton />
          <ListRowSkeleton />
          <ListRowSkeleton />
          <ListRowSkeleton />
        </VStack>
      </ScreenShell>
    );
  }

  const nombre = profile?.nombre ?? user?.nombre ?? '';
  const apellidos = profile?.apellidos ?? user?.apellidos ?? '';
  const especialidades = profile?.especialidades ?? [];

  return (
    <ScreenShell applyBottomInset={false}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.bottomSafe }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <Box className="px-5 pt-2 pb-4">
          <Heading className="text-xl font-bold text-foreground">Perfil</Heading>
        </Box>

        <Box className="px-5">
          <Box className="bg-card border border-border rounded-2xl p-4">
            <HStack className="items-center gap-4">
              <Box className="w-16 h-16 rounded-full bg-primary-soft items-center justify-center">
                <Text className="text-xl font-bold text-primary-strong">{initials}</Text>
              </Box>
              <VStack className="flex-1">
                <Heading className="text-xl font-bold text-foreground">
                  {nombre} {apellidos}
                </Heading>
                <Text className="text-sm text-foreground-secondary">
                  Empleado de ExpressMX
                </Text>
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
        </Box>

        {especialidades.length > 0 ? (
          <Box className="px-5 mt-5">
            <Text className="text-xs font-bold uppercase tracking-wide text-foreground-secondary mb-2">
              Especialidades
            </Text>
            <HStack className="flex-wrap gap-2">
              {especialidades.map((s) => (
                <Box key={s} className="px-3 py-1.5 rounded-full bg-primary-soft">
                  <Text className="text-xs font-semibold text-primary-strong">{s}</Text>
                </Box>
              ))}
            </HStack>
          </Box>
        ) : null}

        <Box className="px-5 mt-6 mb-2">
          <Text className="text-xs font-bold uppercase tracking-wide text-foreground-secondary">
            Trabajo
          </Text>
        </Box>
        <VStack className="px-5 gap-2">
          <ListRow
            icon={<Toolbox size={20} color={palette.textPrimary} />}
            title="Capacidades"
            description="Servicios habilitados por Operaciones"
            onPress={() => router.push('/provider-services')}
          />
          <ListRow
            icon={<CalendarBlank size={20} color={palette.textPrimary} />}
            title="Mi turno"
            description="Horario asignado por Operaciones"
            onPress={() => router.push('/provider-availability')}
          />
        </VStack>

        <Box className="px-5 mt-6 mb-2">
          <Text className="text-xs font-bold uppercase tracking-wide text-foreground-secondary">
            Documentos
          </Text>
        </Box>
        {documents.length === 0 ? (
          <Box className="px-5">
            <VStack className="py-6 px-4 rounded-xl bg-muted items-center gap-2">
              <Text className="text-sm text-foreground-secondary text-center">
                Tus documentos aparecerán aquí cuando RRHH los suba.
              </Text>
            </VStack>
          </Box>
        ) : (
          <VStack className="px-5 gap-2">
            {documents.map((d) => (
              <Box key={d.id} className="bg-card border border-border rounded-xl p-3">
                <HStack className="items-center gap-3">
                  <Box className="w-10 h-10 rounded-lg bg-muted items-center justify-center">
                    {DOC_ICONS[d.tipo]}
                  </Box>
                  <VStack className="flex-1">
                    <Text className="text-sm font-bold text-foreground">{d.titulo}</Text>
                    <Text className="text-xs text-foreground-secondary">{d.detalle}</Text>
                  </VStack>
                  <StatusGlyph estatus={d.estatus} />
                </HStack>
              </Box>
            ))}
          </VStack>
        )}

        <Box className="px-5 mt-6 mb-2">
          <Text className="text-xs font-bold uppercase tracking-wide text-foreground-secondary">
            Cuenta
          </Text>
        </Box>
        <VStack className="px-5 gap-2">
          <ListRow
            icon={<Bank size={20} color={palette.textPrimary} />}
            title="Cuenta bancaria"
            description={
              bankAccount
                ? `${bankAccount.banco_nombre} · ${bankAccount.clabe_mascara} · ${bankAccount.estatus}`
                : 'Pendiente por RRHH'
            }
            onPress={() => router.push('/provider-bank-account')}
          />
          <ListRow
            icon={<Headset size={20} color={palette.textPrimary} />}
            title="Soporte"
            description="Para incidencias en sitio o pagos"
            onPress={() => router.push('/support')}
          />
        </VStack>

        <Box className="px-5 mt-8">
          <ListRow
            icon={<SignOut size={20} color={palette.danger} />}
            title="Cerrar sesión"
            destructive
            onPress={confirmLogout}
          />
        </Box>

        <Box className="px-5 mt-6">
          <Text className="text-xs text-foreground-secondary text-center">
            ExpressMX Prestador · v1.0
          </Text>
        </Box>
      </ScrollView>
    </ScreenShell>
  );
}
