import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Camera,
  Check,
  Circle,
  CurrencyCircleDollar,
  Lock,
  Pause,
  Play,
} from 'phosphor-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { BottomBar } from '@/components/ui-app/bottom-bar';
import { HeaderSkeleton } from '@/components/ui-app/header-skeleton';
import { InlineAlert } from '@/components/ui-app/inline-alert';
import { ListRowSkeleton } from '@/components/ui-app/list-row-skeleton';
import { LocationMap } from '@/components/ui-app/location-map';
import { PrimaryButton } from '@/components/ui-app/primary-button';
import { ScreenHeader } from '@/components/ui-app/screen-header';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { Skeleton } from '@/components/ui-app/skeleton';
import { api, ApiError } from '@/lib/api/client';
import { formatMxn, palette, spacing } from '@/lib/theme/tokens';

type StepKey =
  | 'pin_cliente'
  | 'foto_antes'
  | 'diagnostico'
  | 'reparacion'
  | 'foto_despues'
  | 'pin_prestador';

interface CargoExtra {
  id: string;
  descripcion: string;
  monto: number;
  estatus: 'propuesto' | 'aceptado' | 'rechazado';
}

interface JobActiveState {
  orden_id: string;
  servicio_nombre: string;
  cliente_nombre: string;
  direccion: string | null;
  direccion_latitud: number | null;
  direccion_longitud: number | null;
  cronometro_segundos: number;
  cronometro_corriendo: boolean;
  pasos_completados: StepKey[];
  cargos_extra: CargoExtra[];
  evidencias_count: { antes: number; despues: number };
}

interface JobActiveResponse {
  data: JobActiveState;
}

const STEP_DEF: { id: StepKey; title: string; description: string }[] = [
  {
    id: 'pin_cliente',
    title: 'Llegada y PIN del cliente',
    description: 'Confirma la dirección antes de iniciar',
  },
  { id: 'foto_antes', title: 'Foto ANTES', description: 'Evidencia inicial del estado' },
  { id: 'diagnostico', title: 'Diagnóstico', description: 'Causa raíz y materiales necesarios' },
  { id: 'reparacion', title: 'Reparación', description: 'Trabajo principal terminado' },
  { id: 'foto_despues', title: 'Foto DESPUÉS', description: 'Evidencia para cliente y empresa' },
  { id: 'pin_prestador', title: 'Cierre con tu PIN', description: 'El cliente lo confirma desde su app' },
];

function formatTimer(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export default function JobActiveScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, setState] = useState<JobActiveState | null>(null);
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cronometroCorriendo = state?.cronometro_corriendo;

  const load = useCallback(async () => {
    try {
      const response = await api.get<JobActiveResponse>(`/v1/mobile/provider/jobs/${id}/active`);
      setState(response.data);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'No pudimos cargar el servicio.';
      setGlobalError(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!cronometroCorriendo) {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }
    tickRef.current = setInterval(() => {
      setState((prev) =>
        prev ? { ...prev, cronometro_segundos: prev.cronometro_segundos + 1 } : prev,
      );
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [cronometroCorriendo]);

  async function togglePause() {
    if (!state) return;
    const next = !state.cronometro_corriendo;
    setState({ ...state, cronometro_corriendo: next });
    try {
      await api.post(`/v1/mobile/provider/jobs/${state.orden_id}/cronometro`, {
        accion: next ? 'reanudar' : 'pausar',
      });
    } catch {
      setState((prev) => (prev ? { ...prev, cronometro_corriendo: !next } : prev));
    }
  }

  async function markStep(step: Exclude<StepKey, 'pin_cliente' | 'pin_prestador'>) {
    if (!state || submitting) return;
    if (step === 'foto_antes' || step === 'foto_despues') {
      router.push({
        pathname: '/jobs/[id]/active/evidencias',
        params: { id: state.orden_id, fase: step === 'foto_antes' ? 'antes' : 'despues' },
      });
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/v1/mobile/provider/jobs/${state.orden_id}/checklist`, { paso: step });
      await load();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'No pudimos marcar el paso.';
      setGlobalError(message);
    } finally {
      setSubmitting(false);
    }
  }

  function goPin(target: 'pin_cliente' | 'pin_prestador') {
    if (!state) return;
    router.push({
      pathname:
        target === 'pin_cliente'
          ? '/jobs/[id]/active/pin-cliente'
          : '/jobs/[id]/active/pin-prestador',
      params: { id: state.orden_id },
    });
  }

  function goSobrecosto() {
    if (!state) return;
    router.push({ pathname: '/jobs/[id]/active/sobrecosto', params: { id: state.orden_id } });
  }

  async function finalize() {
    if (!state) return;
    Alert.alert(
      'Finalizar servicio',
      '¿Confirmas que terminaste? Después de esto la orden quedará completada.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            try {
              await api.post(`/v1/mobile/provider/jobs/${state.orden_id}/complete`);
              router.replace('/(tabs)/home');
            } catch (err) {
              const message =
                err instanceof ApiError ? err.message : 'No pudimos finalizar el servicio.';
              setGlobalError(message);
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <ScreenShell>
        <ScreenHeader title="En servicio" />
        <HeaderSkeleton withAvatar />
        <Box className="px-5 pt-2">
          <Skeleton width="100%" height={72} radius={16} />
        </Box>
        <VStack className="px-5 mt-4 gap-2">
          <ListRowSkeleton />
          <ListRowSkeleton />
          <ListRowSkeleton />
          <ListRowSkeleton />
        </VStack>
      </ScreenShell>
    );
  }

  if (!state) {
    return (
      <ScreenShell>
        <ScreenHeader title="En servicio" />
        <Box className="flex-1 items-center justify-center px-6">
          <Text className="text-base font-semibold text-foreground text-center">
            {globalError ?? 'No encontramos este servicio'}
          </Text>
          <Box className="w-full mt-6">
            <PrimaryButton onPress={() => router.replace('/(tabs)/home')}>
              Volver al inicio
            </PrimaryButton>
          </Box>
        </Box>
      </ScreenShell>
    );
  }

  const completedSet = new Set(state.pasos_completados);
  const allDone = STEP_DEF.every((s) => completedSet.has(s.id));
  const activeStep = STEP_DEF.find((s) => !completedSet.has(s.id))?.id;
  const activeStepDef = STEP_DEF.find((s) => s.id === activeStep);
  const pinClienteHecho = completedSet.has('pin_cliente');
  const totalExtras = state.cargos_extra
    .filter((e) => e.estatus !== 'rechazado')
    .reduce((acc, e) => acc + e.monto, 0);

  return (
    <ScreenShell>
      <ScreenHeader
        title="En servicio"
        subtitle={`${state.servicio_nombre} · ${state.cliente_nombre}`}
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.gutter,
          paddingTop: spacing.lg,
          paddingBottom: spacing.bottomBar,
        }}
      >
        {globalError ? (
          <Box className="mb-3">
            <InlineAlert tone="danger" message={globalError} />
          </Box>
        ) : null}

        {state.direccion || state.direccion_latitud !== null ? (
          <Box className="mb-3">
            <LocationMap
              title="Ubicación del cliente"
              address={state.direccion}
              latitude={state.direccion_latitud}
              longitude={state.direccion_longitud}
            />
          </Box>
        ) : null}

        <Box
          className={`rounded-xl p-3.5 border ${
            pinClienteHecho ? 'bg-primary-soft border-border' : 'bg-muted border-border'
          }`}
        >
          <HStack className="items-center gap-3">
            <Box
              className={`w-2.5 h-2.5 rounded-full ${pinClienteHecho ? 'bg-primary' : 'bg-border-strong'}`}
            />
            <VStack className="flex-1">
              <Text className="text-sm font-bold text-foreground">
                {pinClienteHecho
                  ? `Trabajando · ${formatTimer(state.cronometro_segundos)}`
                  : 'Revisa la ubicación antes de pedir el PIN'}
              </Text>
              <Text className="text-xs text-foreground-secondary">
                {pinClienteHecho
                  ? state.cronometro_corriendo
                    ? 'Cronómetro activo'
                    : 'Pausado'
                  : 'El PIN arranca el cronómetro del servicio'}
              </Text>
            </VStack>
            {pinClienteHecho ? (
              <Pressable
                onPress={togglePause}
                className="px-3 py-1.5 rounded-full bg-card border border-border"
                hitSlop={6}
              >
                <HStack className="items-center gap-1">
                  {state.cronometro_corriendo ? (
                    <Pause size={14} color={palette.textPrimary} />
                  ) : (
                    <Play size={14} color={palette.textPrimary} />
                  )}
                  <Text className="text-xs font-semibold text-foreground">
                    {state.cronometro_corriendo ? 'Pausar' : 'Reanudar'}
                  </Text>
                </HStack>
              </Pressable>
            ) : null}
          </HStack>
        </Box>

        <HStack className="items-end justify-between mt-4 mb-2">
          <VStack className="flex-1">
            <Heading className="text-base font-bold text-foreground">Progreso del servicio</Heading>
            <Text className="text-xs text-foreground-secondary">
              {activeStepDef
                ? `Siguiente: ${activeStepDef.title}`
                : 'Todos los pasos requeridos están completos'}
            </Text>
          </VStack>
          <Text className="text-xs font-semibold text-foreground-secondary">
            {completedSet.size}/{STEP_DEF.length}
          </Text>
        </HStack>

        <VStack className="gap-2">
          {STEP_DEF.map((step, index) => {
            const done = completedSet.has(step.id);
            const isActive = !done && step.id === activeStep;
            const isPin = step.id === 'pin_cliente' || step.id === 'pin_prestador';
            const isFoto = step.id === 'foto_antes' || step.id === 'foto_despues';
            return (
              <Pressable
                key={step.id}
                onPress={() => {
                  if (done) return;
                  if (step.id === 'pin_cliente' || step.id === 'pin_prestador') {
                    goPin(step.id);
                  } else {
                    markStep(step.id);
                  }
                }}
                disabled={done}
              >
                <Box
                  className={`rounded-xl p-3 border ${
                    isActive ? 'bg-primary-soft border-border' : 'bg-card border-border'
                  }`}
                >
                  <HStack className="items-start gap-3">
                    <Box
                      className={`w-7 h-7 rounded-full items-center justify-center mt-0.5 ${
                        done ? 'bg-primary' : 'bg-card border border-border-strong'
                      }`}
                    >
                      {done ? (
                        <Check size={14} color={palette.white} weight="bold" />
                      ) : isPin ? (
                        <Lock size={14} color={palette.textTertiary} />
                      ) : isFoto ? (
                        <Camera size={14} color={palette.textTertiary} />
                      ) : (
                        <Circle size={6} color={palette.textDisabled} weight="fill" />
                      )}
                    </Box>
                    <VStack className="flex-1">
                      <Text className="text-[11px] font-semibold text-foreground-secondary">
                        Paso {index + 1} de {STEP_DEF.length}
                      </Text>
                      <Text
                        className={`text-sm font-bold ${
                          done ? 'text-foreground-secondary line-through' : 'text-foreground'
                        }`}
                      >
                        {step.title}
                      </Text>
                      <Text className="text-xs text-foreground-secondary">{step.description}</Text>
                      {step.id === 'foto_antes' && state.evidencias_count.antes > 0 ? (
                        <Text className="text-[11px] text-primary-strong font-semibold mt-0.5">
                          {state.evidencias_count.antes} fotos subidas
                        </Text>
                      ) : null}
                      {step.id === 'foto_despues' && state.evidencias_count.despues > 0 ? (
                        <Text className="text-[11px] text-primary-strong font-semibold mt-0.5">
                          {state.evidencias_count.despues} fotos subidas
                        </Text>
                      ) : null}
                    </VStack>
                  </HStack>
                </Box>
              </Pressable>
            );
          })}
        </VStack>

        {state.cargos_extra.length > 0 ? (
          <VStack className="mt-6 gap-2">
            <HStack className="items-baseline justify-between">
              <Heading className="text-base font-bold text-foreground">Sobrecostos</Heading>
              <Text className="text-sm font-bold text-primary">{formatMxn(totalExtras)}</Text>
            </HStack>
            {state.cargos_extra.map((ex) => (
              <Box key={ex.id} className="bg-card border border-border rounded-xl p-3">
                <HStack className="items-center gap-3">
                  <Box className="w-9 h-9 rounded-lg bg-warning-soft items-center justify-center">
                    <CurrencyCircleDollar size={18} color={palette.warning} weight="fill" />
                  </Box>
                  <VStack className="flex-1">
                    <Text className="text-sm font-bold text-foreground">{ex.descripcion}</Text>
                    <Text className="text-xs text-foreground-secondary">
                      {ex.estatus === 'propuesto'
                        ? 'Esperando aprobación del cliente'
                        : ex.estatus === 'aceptado'
                          ? 'Autorizado por el cliente'
                          : 'Rechazado por el cliente'}
                    </Text>
                  </VStack>
                  <Text
                    className={`text-sm font-bold ${
                      ex.estatus === 'rechazado'
                        ? 'text-foreground-secondary line-through'
                        : 'text-foreground'
                    }`}
                  >
                    {formatMxn(ex.monto)}
                  </Text>
                </HStack>
              </Box>
            ))}
          </VStack>
        ) : null}
      </ScrollView>

      <BottomBar>
        <HStack className="gap-3">
          <Box className="flex-1">
            <PrimaryButton variant="outline" onPress={goSobrecosto}>
              Reportar sobrecosto
            </PrimaryButton>
          </Box>
          <Box className="flex-[2]">
            <PrimaryButton onPress={finalize} disabled={!allDone || submitting}>
              {allDone
                ? 'Finalizar servicio'
                : `Faltan ${STEP_DEF.length - completedSet.size} pasos`}
            </PrimaryButton>
          </Box>
        </HStack>
      </BottomBar>

    </ScreenShell>
  );
}
