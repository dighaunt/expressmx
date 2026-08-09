import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Box } from '@/components/ui/box';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { PrimaryButton } from '@/components/ui-app/primary-button';
import { ScreenHeader } from '@/components/ui-app/screen-header';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { api, ApiError } from '@/lib/api/client';
import { palette } from '@/lib/theme/tokens';

export interface JobDetail {
  id: string;
  estatus: 'solicitada' | 'asignada' | 'en_camino' | 'en_progreso' | 'completada' | 'cancelada';
  servicio_nombre: string;
  servicio_descripcion: string | null;
  servicio_duracion_min: number | null;
  cliente_nombre: string;
  cliente_telefono: string | null;
  cliente_rating: number | null;
  cliente_zona: string | null;
  direccion: string | null;
  direccion_referencia: string | null;
  direccion_latitud: number | null;
  direccion_longitud: number | null;
  fecha_programada: string | null;
  notas: string | null;
  total: number;
  aceptada_at: string | null;
  en_camino_at: string | null;
  en_progreso_at: string | null;
  completada_at: string | null;
}

interface JobDetailResponse {
  orden: JobDetail;
}

interface JobDetailContextValue {
  detail: JobDetail;
  refetch: () => Promise<void>;
}

const JobDetailContext = createContext<JobDetailContextValue | null>(null);

export function useJobDetail(): JobDetailContextValue {
  const ctx = useContext(JobDetailContext);
  if (!ctx) {
    throw new Error('useJobDetail must be used within a JobByIdLayout provider');
  }
  return ctx;
}

export default function JobByIdLayout() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [data, setData] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setError('Falta el id del trabajo.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<JobDetailResponse>(`/v1/mobile/provider/jobs/${id}`);
      setData(response.orden);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'No pudimos cargar el trabajo.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const refetch = useCallback(async () => {
    await load();
  }, [load]);

  if (loading) {
    return (
      <ScreenShell>
        <ScreenHeader title="Trabajo" />
        <Box className="flex-1 items-center justify-center">
          <Spinner color={palette.brand} />
        </Box>
      </ScreenShell>
    );
  }

  if (error || !data) {
    return (
      <ScreenShell>
        <ScreenHeader title="Trabajo" />
        <Box className="flex-1 items-center justify-center px-6">
          <Text className="text-base font-semibold text-foreground text-center">
            {error ?? 'No encontramos este trabajo'}
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

  return (
    <JobDetailContext.Provider value={{ detail: data, refetch }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="active" />
      </Stack>
    </JobDetailContext.Provider>
  );
}
