import { Key, ShieldCheck } from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { InlineAlert } from '@/components/ui-app/inline-alert';
import { PrimaryButton } from '@/components/ui-app/primary-button';
import { api, ApiError } from '@/lib/api/client';
import { palette } from '@/lib/theme/tokens';

interface PinResponse {
  data: {
    pin: string;
    expira_en: string;
    nota: string;
  };
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Expirado';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function SupportPinSection() {
  const [pin, setPin] = useState<string | null>(null);
  const [expiraEn, setExpiraEn] = useState<string | null>(null);
  const [restante, setRestante] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!expiraEn) return;
    const tick = () => {
      const ms = new Date(expiraEn).getTime() - Date.now();
      setRestante(ms);
      if (ms <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [expiraEn]);

  async function handleGenerar() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.post<PinResponse>('/v1/mobile/support-pins');
      setPin(res.data.pin);
      setExpiraEn(res.data.expira_en);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : 'No pudimos generar el PIN. Inténtalo de nuevo.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }

  const expirado = restante <= 0;

  if (pin && !expirado) {
    const digits = pin.split('');
    return (
      <VStack className="gap-3 rounded-2xl border border-success/40 bg-success/10 p-5">
        <HStack className="items-center gap-2">
          <ShieldCheck size={18} color={palette.success} weight="duotone" />
          <Heading className="text-sm font-bold text-foreground">PIN listo para soporte</Heading>
        </HStack>
        <HStack className="justify-center gap-2">
          {digits.map((d, i) => (
            <Box
              key={`pin-${i}`}
              className="rounded-lg bg-background border border-border"
              style={{ width: 40, height: 48, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text
                className="font-bold text-foreground"
                style={{ fontSize: 22, fontVariant: ['tabular-nums'] }}
              >
                {d}
              </Text>
            </Box>
          ))}
        </HStack>
        <Text className="text-xs text-foreground-secondary text-center">
          Dale este número al agente de soporte. Expira en {formatRemaining(restante)}.
        </Text>
        <Text className="text-[11px] text-foreground-secondary text-center">
          Es de un solo uso. Si caduca antes de hablar con el agente, genera otro.
        </Text>
      </VStack>
    );
  }

  return (
    <VStack className="gap-3 rounded-2xl border border-border bg-card p-5">
      <HStack className="items-center gap-2">
        <Key size={18} color={palette.brand} weight="duotone" />
        <Heading className="text-sm font-bold text-foreground">PIN para hablar con soporte</Heading>
      </HStack>
      <Text className="text-xs text-foreground-secondary">
        Si llamas o chateas con un agente de soporte, te van a pedir un PIN para acceder a tu
        cuenta. Genéralo aquí y compártelo solo con el agente. Expira a los 15 minutos.
      </Text>
      {expirado && pin ? (
        <Text className="text-[11px] text-warning-foreground">
          El PIN anterior expiró. Genera uno nuevo.
        </Text>
      ) : null}
      {errorMsg ? <InlineAlert tone="danger" message={errorMsg} /> : null}
      <PrimaryButton variant="primary" onPress={handleGenerar} loading={loading}>
        {loading ? 'Generando…' : 'Generar PIN de soporte'}
      </PrimaryButton>
    </VStack>
  );
}
