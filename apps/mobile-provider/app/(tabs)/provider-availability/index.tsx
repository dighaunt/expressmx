import { useFocusEffect } from 'expo-router';
import { CalendarBlank } from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { ListRowSkeleton } from '@/components/ui-app/list-row-skeleton';
import { ScreenHeader } from '@/components/ui-app/screen-header';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { api } from '@/lib/api/client';
import { palette, spacing } from '@/lib/theme/tokens';

type Dia = 'lun' | 'mar' | 'mie' | 'jue' | 'vie' | 'sab' | 'dom';

interface Slot {
  id: string;
  dia: Dia;
  hora_inicio: string;
  hora_fin: string;
}

interface AvailabilityResponse {
  data: Slot[];
}

const DAY_LABEL: Record<Dia, string> = {
  lun: 'Lunes',
  mar: 'Martes',
  mie: 'Miércoles',
  jue: 'Jueves',
  vie: 'Viernes',
  sab: 'Sábado',
  dom: 'Domingo',
};

const DAY_ORDER: Dia[] = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];

function formatRange(inicio: string, fin: string): string {
  return `${inicio.slice(0, 5)} – ${fin.slice(0, 5)}`;
}

export default function ProviderAvailabilityScreen() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await api.get<AvailabilityResponse>('/v1/mobile/provider/availability');
      setSlots(response.data ?? []);
    } catch {
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const grouped: Record<Dia, Slot[]> = {
    lun: [], mar: [], mie: [], jue: [], vie: [], sab: [], dom: [],
  };
  for (const s of slots) {
    grouped[s.dia].push(s);
  }
  for (const d of DAY_ORDER) {
    grouped[d].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
  }

  if (loading && slots.length === 0) {
    return (
      <ScreenShell applyBottomInset={false}>
        <ScreenHeader title="Mi turno" />
        <VStack
          className="gap-2"
          style={{ paddingHorizontal: spacing.gutter, paddingTop: spacing.lg }}
        >
          <ListRowSkeleton showLeading />
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
      <ScreenHeader title="Mi turno" subtitle="Horario asignado por Operaciones" />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.gutter,
          paddingTop: spacing.lg,
          paddingBottom: spacing.bottomBar,
        }}
      >
        {slots.length === 0 ? (
          <VStack className="py-10 px-5 rounded-xl bg-muted items-center gap-3">
            <Box className="w-14 h-14 rounded-xl bg-background items-center justify-center">
              <CalendarBlank size={28} color={palette.brand} weight="duotone" />
            </Box>
            <VStack className="items-center gap-1">
              <Text className="text-base font-semibold text-foreground">
                Aún no hay horario asignado
              </Text>
              <Text className="text-sm text-foreground-secondary text-center">
                RRHH u Operaciones publicará aquí tus turnos.
              </Text>
            </VStack>
          </VStack>
        ) : (
          <VStack>
            {DAY_ORDER.map((dia, index) => {
              const turnos = grouped[dia];
              const empty = turnos.length === 0;
              return (
                <Box key={dia}>
                  <HStack className={`items-center gap-3 py-3 ${empty ? 'opacity-70' : ''}`}>
                    <Box
                      className={`w-9 h-9 rounded-lg items-center justify-center ${empty ? 'bg-muted' : 'bg-primary-soft'}`}
                    >
                      <Text
                        className={`text-sm font-bold ${empty ? 'text-foreground-secondary' : 'text-primary-strong'}`}
                      >
                        {dia.charAt(0).toUpperCase()}
                      </Text>
                    </Box>
                    <VStack className="flex-1">
                      <Text
                        className={`text-sm font-bold ${empty ? 'text-foreground-secondary' : 'text-foreground'}`}
                      >
                        {DAY_LABEL[dia]}
                      </Text>
                      <Text className="text-xs text-foreground-secondary">
                        {empty
                          ? 'Sin turno asignado'
                          : turnos.map((t) => formatRange(t.hora_inicio, t.hora_fin)).join(' · ')}
                      </Text>
                    </VStack>
                  </HStack>
                  {index < DAY_ORDER.length - 1 ? <Box style={styles.separator} /> : null}
                </Box>
              );
            })}
          </VStack>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 48,
    backgroundColor: palette.border,
  },
});
