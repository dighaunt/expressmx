import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { CheckCircle, Circle } from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { ScrollView } from 'react-native';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { FormField } from '@/components/ui-app/form-field';
import { HeaderSkeleton } from '@/components/ui-app/header-skeleton';
import { InlineAlert } from '@/components/ui-app/inline-alert';
import { ListRowSkeleton } from '@/components/ui-app/list-row-skeleton';
import { PrimaryButton } from '@/components/ui-app/primary-button';
import { ScreenHeader } from '@/components/ui-app/screen-header';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { StatusBadge } from '@/components/ui-app/status-badge';
import { api, ApiError } from '@/lib/api/client';
import { palette, type Tone } from '@/lib/theme/tokens';

interface Ticket {
  id: string;
  asunto: string;
  estatus: 'abierto' | 'en_revision' | 'resuelto' | 'escalado';
  categoria: string;
  tipo: string;
  tier_actual: string;
  created_at: string;
  updated_at: string;
}

interface Mensaje {
  id: string;
  contenido: string;
  tipo_autor: 'usuario' | 'agente' | 'sistema';
  created_at: string;
}

type TareaEstado =
  | 'abierta'
  | 'en_progreso'
  | 'esperando_aprobacion'
  | 'bloqueada'
  | 'completada'
  | 'cancelada';

interface TareaVisible {
  id: string;
  asunto: string;
  titulo_cliente: string | null;
  estado: TareaEstado;
  completada_at: string | null;
  created_at: string;
}

interface TicketResponse {
  data: {
    ticket: Ticket;
    mensajes: Mensaje[];
    tareas_visibles?: TareaVisible[];
  };
}

const TONE: Record<Ticket['estatus'], Tone> = {
  abierto: 'info',
  en_revision: 'warning',
  resuelto: 'success',
  escalado: 'danger',
};

const LABEL: Record<Ticket['estatus'], string> = {
  abierto: 'Abierto',
  en_revision: 'En revisión',
  resuelto: 'Resuelto',
  escalado: 'Escalado',
};

const TAREA_TONE: Record<TareaEstado, Tone> = {
  abierta: 'info',
  en_progreso: 'warning',
  esperando_aprobacion: 'warning',
  bloqueada: 'danger',
  completada: 'success',
  cancelada: 'neutral',
};

const TAREA_LABEL: Record<TareaEstado, string> = {
  abierta: 'Abierta',
  en_progreso: 'En progreso',
  esperando_aprobacion: 'Esperando aprobación',
  bloqueada: 'Bloqueada',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [tareas, setTareas] = useState<TareaVisible[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [respuesta, setRespuesta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [respondError, setRespondError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setError('Falta el id del reporte.');
      setLoading(false);
      return;
    }
    try {
      const response = await api.get<TicketResponse>(`/v1/mobile/tickets/${id}`);
      setTicket(response.data.ticket);
      setMensajes(response.data.mensajes ?? []);
      setTareas(response.data.tareas_visibles ?? []);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'No pudimos cargar el reporte.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function enviarRespuesta() {
    if (!id || !respuesta.trim() || enviando) return;
    setEnviando(true);
    setRespondError(null);
    try {
      await api.post(`/v1/mobile/tickets/${id}/responder`, { contenido: respuesta.trim() });
      setRespuesta('');
      await load();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'No pudimos enviar tu respuesta.';
      setRespondError(message);
    } finally {
      setEnviando(false);
    }
  }

  if (loading) {
    return (
      <ScreenShell applyBottomInset={false}>
        <ScreenHeader title="Reporte" />
        <HeaderSkeleton />
        <VStack className="px-5 gap-2 mt-2">
          <ListRowSkeleton />
          <ListRowSkeleton />
          <ListRowSkeleton />
          <ListRowSkeleton />
        </VStack>
      </ScreenShell>
    );
  }

  if (error || !ticket) {
    return (
      <ScreenShell>
        <ScreenHeader title="Reporte" />
        <Box className="flex-1 items-center justify-center px-6">
          <Text className="text-base font-semibold text-foreground text-center">
            {error ?? 'No encontramos este reporte'}
          </Text>
        </Box>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell applyBottomInset={false}>
      <ScreenHeader title={`#${ticket.id.slice(0, 8).toUpperCase()}`} subtitle={ticket.asunto} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 32,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <HStack className="items-center justify-between mb-3">
          <StatusBadge label={LABEL[ticket.estatus]} tone={TONE[ticket.estatus]} />
          <Text className="text-xs text-foreground-secondary">
            {new Date(ticket.created_at).toLocaleString('es-MX', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </HStack>

        {tareas.length > 0 ? (
          <Box className="bg-card border border-border rounded-2xl p-4 mb-3">
            <Text className="text-xs uppercase tracking-wide text-foreground-secondary font-bold mb-3">
              Avance del caso
            </Text>
            <VStack className="gap-2">
              {tareas.map((t) => {
                const completed = t.estado === 'completada';
                const titulo = t.titulo_cliente ?? t.asunto;
                return (
                  <HStack key={t.id} className="items-start gap-3">
                    {completed ? (
                      <CheckCircle size={20} color={palette.brand} weight="fill" />
                    ) : (
                      <Circle size={20} color={palette.textSecondary} weight="regular" />
                    )}
                    <VStack className="flex-1 gap-1">
                      <Text
                        className={`text-sm ${completed ? 'text-foreground-secondary line-through' : 'text-foreground'}`}
                      >
                        {titulo}
                      </Text>
                      <StatusBadge label={TAREA_LABEL[t.estado]} tone={TAREA_TONE[t.estado]} />
                    </VStack>
                  </HStack>
                );
              })}
            </VStack>
          </Box>
        ) : null}

        {mensajes.length === 0 ? (
          <Box className="py-6 px-4 rounded-xl bg-muted">
            <Text className="text-sm text-foreground-secondary text-center">
              Sin respuestas todavía. Un agente te contactará pronto.
            </Text>
          </Box>
        ) : (
          <VStack className="gap-2">
            {mensajes.map((m) => {
              const mine = m.tipo_autor === 'usuario';
              return (
                <Box
                  key={m.id}
                  className={`rounded-2xl p-3 max-w-[85%] ${
                    mine
                      ? 'bg-primary self-end'
                      : m.tipo_autor === 'sistema'
                        ? 'bg-muted self-center'
                        : 'bg-card border border-border self-start'
                  }`}
                >
                  <Text
                    className={`text-sm ${mine ? 'text-primary-foreground' : 'text-foreground'}`}
                  >
                    {m.contenido}
                  </Text>
                  <Text
                    className={`text-[10px] mt-1 ${mine ? 'text-primary-foreground/70' : 'text-foreground-secondary'}`}
                  >
                    {new Date(m.created_at).toLocaleTimeString('es-MX', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </Box>
              );
            })}
          </VStack>
        )}

        {ticket.estatus !== 'resuelto' ? (
          <Box className="mt-5 bg-card border border-border rounded-2xl p-4">
            <Text className="text-xs uppercase tracking-wide text-foreground-secondary font-bold mb-2">
              Responder
            </Text>
            {respondError ? (
              <Box className="mb-2">
                <InlineAlert tone="danger" message={respondError} />
              </Box>
            ) : null}
            <FormField
              label="Tu mensaje"
              value={respuesta}
              onChangeText={setRespuesta}
              placeholder="Escribe los detalles que faltan o pregunta lo que necesites"
              multiline
              numberOfLines={4}
              maxLength={5000}
              autoCapitalize="sentences"
            />
            <Box className="mt-3">
              <PrimaryButton
                onPress={enviarRespuesta}
                loading={enviando}
                disabled={enviando || !respuesta.trim()}
              >
                {enviando ? 'Enviando...' : 'Enviar respuesta'}
              </PrimaryButton>
            </Box>
          </Box>
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}
