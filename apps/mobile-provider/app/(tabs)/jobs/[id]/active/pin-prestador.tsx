import { useLocalSearchParams, useRouter } from 'expo-router';
import { Lock } from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { BottomBar } from '@/components/ui-app/bottom-bar';
import { InlineAlert } from '@/components/ui-app/inline-alert';
import { PrimaryButton } from '@/components/ui-app/primary-button';
import { ScreenHeader } from '@/components/ui-app/screen-header';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { Spinner } from '@/components/ui/spinner';
import { api, ApiError } from '@/lib/api/client';
import { palette } from '@/lib/theme/tokens';

interface PinPrestadorResponse {
  data: { pin: string; usado: boolean };
}

const POLL_INTERVAL_MS = 5000;

export default function PinPrestadorScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [pin, setPin] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmadoPorCliente, setConfirmadoPorCliente] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    async function fetchOnce() {
      try {
        const response = await api.get<PinPrestadorResponse>(
          `/v1/mobile/provider/jobs/${id}/pin/prestador`,
        );
        if (cancelledRef.current) return response;
        setPin(response.data.pin);
        setError(null);
        if (response.data.usado) {
          setConfirmadoPorCliente(true);
        }
        return response;
      } catch (err) {
        if (cancelledRef.current) return null;
        const message =
          err instanceof ApiError ? err.message : 'No pudimos obtener tu PIN de cierre.';
        setError(message);
        return null;
      } finally {
        if (!cancelledRef.current) setLoading(false);
      }
    }

    void fetchOnce();
    const interval = setInterval(() => {
      if (cancelledRef.current) return;
      void fetchOnce();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelledRef.current = true;
      clearInterval(interval);
    };
  }, [id]);

  function backToActive() {
    router.replace({ pathname: '/jobs/[id]/active', params: { id } });
  }

  if (loading) {
    return (
      <ScreenShell>
        <ScreenHeader title="Cierre con tu PIN" />
        <Box className="flex-1 items-center justify-center">
          <Spinner color={palette.brand} />
        </Box>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <ScreenHeader
        title="Cierre con tu PIN"
        subtitle="Comparte tu código con el cliente para finalizar"
      />

      <Box className="flex-1 px-6 pt-6">
        <VStack className="gap-6 items-center">
          <Box className="w-16 h-16 rounded-2xl bg-primary-soft items-center justify-center">
            <Lock size={32} color={palette.brandStrong} weight="duotone" />
          </Box>

          <VStack className="items-center gap-1 px-4">
            <Heading className="text-xl font-bold text-foreground text-center">
              Lee este código al cliente
            </Heading>
            <Text className="text-sm text-foreground-secondary text-center">
              Lo va a teclear en su app para confirmar que el servicio se cerró bien.
            </Text>
          </VStack>

          <Box className="w-full bg-primary-soft rounded-2xl py-8 items-center">
            <Text className="text-xs text-primary-strong uppercase tracking-wide font-bold">
              Tu PIN
            </Text>
            <Heading
              className="text-5xl font-bold text-primary mt-2"
              style={{ letterSpacing: 8 }}
            >
              {pin ?? '------'}
            </Heading>
          </Box>

          {error ? <InlineAlert tone="danger" message={error} /> : null}

          {confirmadoPorCliente ? (
            <InlineAlert
              tone="success"
              title="El cliente confirmó"
              message="Ya puedes finalizar el servicio."
            />
          ) : (
            <HStack className="gap-3 items-center px-2">
              <Spinner color={palette.brand} />
              <Text className="text-sm text-foreground-secondary flex-1">
                Esperando a que el cliente teclee este código en su app…
              </Text>
            </HStack>
          )}
        </VStack>
      </Box>

      <BottomBar>
        <PrimaryButton onPress={backToActive} disabled={!confirmadoPorCliente}>
          {confirmadoPorCliente ? 'Continuar' : 'Esperando al cliente'}
        </PrimaryButton>
      </BottomBar>
    </ScreenShell>
  );
}
