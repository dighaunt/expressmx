import { useRouter } from 'expo-router';
import { Toolbox } from 'phosphor-react-native';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { BottomBar } from '@/components/ui-app/bottom-bar';
import { PrimaryButton } from '@/components/ui-app/primary-button';
import { ScreenHeader } from '@/components/ui-app/screen-header';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { palette } from '@/lib/theme/tokens';

export default function ProviderServicesEditScreen() {
  const router = useRouter();

  return (
    <ScreenShell>
      <ScreenHeader title="Capacidades asignadas" subtitle="Gestionadas por Operaciones" />
      <Box className="flex-1 items-center justify-center px-6">
        <VStack className="items-center gap-3">
          <Box className="w-14 h-14 rounded-xl bg-primary-soft items-center justify-center">
            <Toolbox size={28} color={palette.brandStrong} weight="duotone" />
          </Box>
          <Text className="text-base font-semibold text-foreground text-center">
            Tus capacidades se administran desde ExpressMX.
          </Text>
          <Text className="text-sm text-foreground-secondary text-center">
            Los cambios quedan a cargo de RRHH u Operaciones.
          </Text>
        </VStack>
      </Box>
      <BottomBar>
        <PrimaryButton onPress={() => router.back()}>Volver</PrimaryButton>
      </BottomBar>
    </ScreenShell>
  );
}