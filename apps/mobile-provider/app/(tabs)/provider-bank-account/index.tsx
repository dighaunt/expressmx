import { useFocusEffect } from 'expo-router';
import { Bank, Clock, WarningCircle } from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { ScrollView } from 'react-native';
import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { InlineAlert } from '@/components/ui-app/inline-alert';
import { ScreenHeader } from '@/components/ui-app/screen-header';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { api } from '@/lib/api/client';
import { palette, spacing } from '@/lib/theme/tokens';

interface BankAccountData {
  titular: string;
  banco_nombre: string;
  clabe_mascara: string;
  estatus: 'pendiente' | 'verificada' | 'rechazada';
  rechazo_motivo: string | null;
}

interface BankAccountResponse {
  data: BankAccountData | null;
}

const ESTATUS_COPY: Record<BankAccountData['estatus'], string> = {
  pendiente: 'Pendiente de validación',
  verificada: 'Verificada',
  rechazada: 'Requiere revisión',
};

export default function ProviderBankAccountScreen() {
  const [account, setAccount] = useState<BankAccountData | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await api.get<BankAccountResponse>('/v1/mobile/provider/bank-account');
      setAccount(response.data);
    } catch {
      void 0;
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <ScreenShell applyBottomInset={false}>
      <ScreenHeader title="Cuenta bancaria" subtitle="Información de nómina" />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: spacing.bottomSafe,
        }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {!account && loaded ? (
          <VStack className="rounded-2xl bg-card border border-border p-5 items-center gap-3">
            <Box className="w-14 h-14 rounded-xl bg-muted items-center justify-center">
              <Bank size={28} color={palette.textSecondary} weight="duotone" />
            </Box>
            <Heading className="text-base font-bold text-foreground text-center">
              Sin cuenta registrada
            </Heading>
            <Text className="text-sm text-foreground-secondary text-center">
              RRHH registrará la cuenta donde recibirás tus cortes.
            </Text>
          </VStack>
        ) : null}

        {account ? (
          <VStack className="gap-4">
            <Box className="rounded-2xl bg-card border border-border p-4">
              <HStack className="items-center gap-3">
                <Box className="w-12 h-12 rounded-xl bg-primary-soft items-center justify-center">
                  <Bank size={24} color={palette.brandStrong} weight="duotone" />
                </Box>
                <VStack className="flex-1">
                  <Text className="text-sm font-bold text-foreground">{account.banco_nombre}</Text>
                  <Text className="text-xs text-foreground-secondary">{account.titular}</Text>
                </VStack>
              </HStack>
              <Box className="mt-4 rounded-xl bg-muted px-4 py-3">
                <Text className="text-xs text-foreground-secondary">CLABE</Text>
                <Text className="mt-1 font-mono text-lg font-bold text-foreground">
                  {account.clabe_mascara}
                </Text>
              </Box>
            </Box>

            <InlineAlert
              tone={account.estatus === 'rechazada' ? 'danger' : 'info'}
              title={ESTATUS_COPY[account.estatus]}
              message={
                account.estatus === 'rechazada'
                  ? account.rechazo_motivo ?? 'Contacta a RRHH para actualizar tus datos.'
                  : account.estatus === 'verificada'
                    ? 'Esta cuenta ya puede usarse para cortes.'
                    : 'RRHH validará la cuenta antes del siguiente corte.'
              }
            />
          </VStack>
        ) : null}

        {!loaded ? (
          <HStack className="items-center gap-2 rounded-xl bg-muted px-4 py-3">
            <Clock size={16} color={palette.textSecondary} />
            <Text className="text-sm text-foreground-secondary">Cargando cuenta...</Text>
          </HStack>
        ) : null}

        {loaded && account?.estatus === 'rechazada' ? (
          <HStack className="mt-4 items-start gap-2 rounded-xl bg-muted px-4 py-3">
            <WarningCircle size={16} color={palette.warning} weight="fill" />
            <Text className="flex-1 text-xs text-foreground-secondary">
              Si la cuenta no coincide con tus datos, solicita el ajuste a RRHH.
            </Text>
          </HStack>
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}
