import { useFocusEffect, useRouter } from 'expo-router';
import {
  CaretRight,
  CurrencyDollar,
  HouseLine,
  Phone,
  Question,
  Toolbox,
  UserMinus,
  WarningOctagon,
  WarningCircle,
} from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { Linking, ScrollView } from 'react-native';
import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { JobCardSkeleton } from '@/components/ui-app/job-card-skeleton';
import { PrimaryButton } from '@/components/ui-app/primary-button';
import { ScreenHeader } from '@/components/ui-app/screen-header';
import { ScreenShell } from '@/components/ui-app/screen-shell';
import { StatusBadge } from '@/components/ui-app/status-badge';
import { api } from '@/lib/api/client';
import { palette, type Tone } from '@/lib/theme/tokens';

type Categoria = 'cobro_incorrecto' | 'no_show' | 'dano_propiedad' | 'queja_servicio' | 'otro';

interface Issue {
  id: Categoria;
  label: string;
  description: string;
  icon: React.ReactNode;
}

interface Ticket {
  id: string;
  asunto: string;
  estatus: 'abierto' | 'en_revision' | 'resuelto' | 'escalado';
  categoria: string;
  created_at: string;
}

interface TicketsResponse {
  data: Ticket[];
}

interface ContactosResponse {
  data: {
    telefono: string | null;
    whatsapp: string | null;
    email: string | null;
  };
}

const ISSUES: Issue[] = [
  {
    id: 'no_show',
    label: 'Cliente no estaba en la dirección',
    description: 'Llegaste pero no había nadie',
    icon: <UserMinus size={18} color={palette.warning} weight="bold" />,
  },
  {
    id: 'dano_propiedad',
    label: 'Daño en herramienta o propiedad',
    description: 'Algo se rompió durante el servicio',
    icon: <Toolbox size={18} color={palette.danger} weight="bold" />,
  },
  {
    id: 'queja_servicio',
    label: 'Cliente agresivo o incidente',
    description: 'Reporta para que el equipo intervenga',
    icon: <WarningOctagon size={18} color={palette.danger} weight="bold" />,
  },
  {
    id: 'cobro_incorrecto',
    label: 'Pago o bono incorrecto',
    description: 'Algo no cuadra en mis bonos',
    icon: <CurrencyDollar size={18} color={palette.warning} weight="bold" />,
  },
  {
    id: 'otro',
    label: 'Otro problema',
    description: 'Cuéntanos qué pasó',
    icon: <WarningCircle size={18} color={palette.textSecondary} weight="bold" />,
  },
];

const FAQS = [
  {
    q: '¿Cuándo recibo mi pago?',
    a: 'Los pagos se hacen quincenalmente. Tu sueldo base + bonos del periodo se depositan los días 15 y 30 a la cuenta que tienes registrada.',
  },
  {
    q: '¿Qué hago si no puedo asistir a un servicio?',
    a: 'Avisa cuanto antes desde la app o por la línea de soporte. ExpressMX reasignará la orden a otro prestador disponible.',
  },
  {
    q: '¿Cómo solicito vacaciones o días libres?',
    a: 'Solicítalo con tu supervisor o RRHH para que Operaciones ajuste tu horario asignado.',
  },
  {
    q: '¿Cómo cambio mi cuenta bancaria?',
    a: 'Por seguridad, los cambios bancarios los gestiona RRHH. Reporta uno por soporte y te van a contactar.',
  },
];

const TICKET_TONE: Record<Ticket['estatus'], Tone> = {
  abierto: 'info',
  en_revision: 'warning',
  resuelto: 'success',
  escalado: 'danger',
};

const TICKET_LABEL: Record<Ticket['estatus'], string> = {
  abierto: 'Abierto',
  en_revision: 'En revisión',
  resuelto: 'Resuelto',
  escalado: 'Escalado',
};

export default function ProviderSupport() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [contactos, setContactos] = useState<ContactosResponse['data'] | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await api.get<TicketsResponse>('/v1/mobile/tickets?limit=10');
      setTickets(response.data ?? []);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadContactos = useCallback(async () => {
    try {
      const response = await api.get<ContactosResponse>('/v1/mobile/config/contactos');
      setContactos(response.data);
    } catch {
      setContactos(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      void loadContactos();
    }, [load, loadContactos]),
  );

  function newTicket(categoria: Categoria) {
    router.push({ pathname: '/support/new', params: { categoria } });
  }

  return (
    <ScreenShell applyBottomInset={false}>
      <ScreenHeader title="Soporte" subtitle="Línea exclusiva para prestadores ExpressMX" />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 }}>
        <Box className="bg-primary-soft rounded-2xl p-4">
          <HStack className="items-center gap-3">
            <Box className="w-12 h-12 rounded-full bg-card items-center justify-center">
              <Phone size={20} color={palette.brandStrong} weight="fill" />
            </Box>
            <VStack className="flex-1">
              <Text className="text-sm font-bold text-foreground">Línea 24/7 prestadores</Text>
              <Text className="text-xs text-foreground-secondary">
                {contactos?.telefono ?? 'Cargando contactos...'}
              </Text>
            </VStack>
            {contactos?.telefono ? (
              <Box>
                <PrimaryButton
                  size="sm"
                  fullWidth={false}
                  onPress={() => Linking.openURL(`tel:${contactos.telefono}`)}
                >
                  Llamar
                </PrimaryButton>
              </Box>
            ) : null}
          </HStack>
        </Box>

        <Heading className="mt-6 mb-2 text-base font-bold text-foreground">
          Reportar problema
        </Heading>
        <VStack className="gap-2">
          {ISSUES.map((it) => (
            <Pressable key={it.id} onPress={() => newTicket(it.id)}>
              <Box className="bg-card border border-border rounded-2xl p-4">
                <HStack className="items-center gap-3">
                  <Box className="w-10 h-10 rounded-lg bg-muted items-center justify-center">
                    {it.icon}
                  </Box>
                  <VStack className="flex-1">
                    <Text className="text-sm font-bold text-foreground">{it.label}</Text>
                    <Text className="text-xs text-foreground-secondary">{it.description}</Text>
                  </VStack>
                  <CaretRight size={16} color={palette.textDisabled} />
                </HStack>
              </Box>
            </Pressable>
          ))}
        </VStack>

        <Heading className="mt-6 mb-2 text-base font-bold text-foreground">Tus reportes</Heading>
        {loading && tickets.length === 0 ? (
          <VStack className="gap-2">
            <JobCardSkeleton />
            <JobCardSkeleton />
            <JobCardSkeleton />
          </VStack>
        ) : tickets.length === 0 ? (
          <Box className="py-6 px-4 rounded-xl bg-muted">
            <HStack className="items-center gap-3">
              <HouseLine size={22} color={palette.textSecondary} />
              <Text className="text-sm text-foreground-secondary flex-1">
                Cuando reportes algo aparecerá aquí.
              </Text>
            </HStack>
          </Box>
        ) : (
          <VStack className="gap-2">
            {tickets.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => router.push({ pathname: '/support/[id]', params: { id: t.id } })}
              >
                <Box className="bg-card border border-border rounded-xl p-4">
                  <HStack className="items-center justify-between mb-1">
                    <Text className="text-xs text-foreground-secondary">
                      #{t.id.slice(0, 8).toUpperCase()}
                    </Text>
                    <StatusBadge label={TICKET_LABEL[t.estatus]} tone={TICKET_TONE[t.estatus]} />
                  </HStack>
                  <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                    {t.asunto}
                  </Text>
                </Box>
              </Pressable>
            ))}
          </VStack>
        )}

        <Heading className="mt-6 mb-2 text-base font-bold text-foreground">Preguntas frecuentes</Heading>
        <VStack className="gap-2">
          {FAQS.map((f, i) => {
            const open = expandedFaq === i;
            return (
              <Pressable key={i} onPress={() => setExpandedFaq(open ? null : i)}>
                <Box className="bg-card border border-border rounded-xl p-4">
                  <HStack className="items-start gap-3">
                    <Question size={18} color={palette.textSecondary} />
                    <VStack className="flex-1">
                      <Text className="text-sm font-semibold text-foreground">{f.q}</Text>
                      {open ? (
                        <Text className="text-xs text-foreground-secondary mt-2">{f.a}</Text>
                      ) : null}
                    </VStack>
                  </HStack>
                </Box>
              </Pressable>
            );
          })}
        </VStack>
      </ScrollView>
    </ScreenShell>
  );
}
