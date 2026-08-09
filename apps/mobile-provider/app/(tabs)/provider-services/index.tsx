import { useFocusEffect } from 'expo-router';
import { Toolbox } from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { EmptyState } from '@/components/ui-app/empty-state';
import { ListRowSkeleton } from '@/components/ui-app/list-row-skeleton';
import { ScreenHeader } from '@/components/ui-app/screen-header';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { api } from '@/lib/api/client';
import { palette, spacing } from '@/lib/theme/tokens';

interface ServiceRow {
  id: string;
  servicio_id: string;
  nombre: string;
  categoria: string;
  precio_base: number;
  activo: boolean;
}

interface ServicesResponse {
  data: ServiceRow[];
}

export default function ProviderServicesScreen() {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await api.get<ServicesResponse>('/v1/mobile/provider/services');
      setServices(response.data ?? []);
    } catch {
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const activos = services.filter((s) => s.activo);

  return (
    <ScreenShell applyBottomInset={false}>
      <ScreenHeader title="Capacidades" subtitle="Servicios habilitados por Operaciones" />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.gutter,
          paddingTop: spacing.lg,
          paddingBottom: spacing.bottomBar,
        }}
      >
        {loading && services.length === 0 ? (
          <VStack className="gap-2">
            <ListRowSkeleton showLeading />
            <ListRowSkeleton showLeading />
            <ListRowSkeleton showLeading />
            <ListRowSkeleton showLeading />
            <ListRowSkeleton showLeading />
          </VStack>
        ) : services.length === 0 ? (
          <EmptyState
            icon={<Toolbox size={28} color={palette.brand} weight="duotone" />}
            title="Aún no tienes capacidades asignadas"
            description="RRHH u Operaciones asignará tus servicios autorizados."
          />
        ) : (
          <>
            <Text className="text-xs uppercase tracking-wide text-foreground-secondary font-bold mb-3">
              {activos.length} habilitadas · {services.length - activos.length} suspendidas
            </Text>

            <VStack>
              {services.map((s, index) => (
                <Box key={s.id}>
                  <HStack className={`items-center gap-3 py-3 ${s.activo ? '' : 'opacity-60'}`}>
                    <Box className="w-11 h-11 rounded-lg bg-muted items-center justify-center">
                      <Toolbox size={20} color={palette.brandStrong} />
                    </Box>
                    <VStack className="flex-1">
                      <Text className="text-sm font-bold text-foreground">{s.nombre}</Text>
                      <Text className="text-xs text-foreground-secondary">
                        {s.categoria}
                      </Text>
                    </VStack>
                    <Box
                      className={`px-2.5 py-1 rounded-full ${s.activo ? 'bg-success-soft' : 'bg-muted'}`}
                    >
                      <Text
                        className={`text-[10px] font-bold uppercase ${s.activo ? 'text-success' : 'text-muted-foreground'}`}
                      >
                        {s.activo ? 'Habilitada' : 'Suspendida'}
                      </Text>
                    </Box>
                  </HStack>
                  {index < services.length - 1 ? <Box style={styles.separator} /> : null}
                </Box>
              ))}
            </VStack>
          </>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 56,
    backgroundColor: palette.border,
  },
});
