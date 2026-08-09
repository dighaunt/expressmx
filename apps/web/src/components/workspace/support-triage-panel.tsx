import {
  ArrowUpRight,
  Books,
  CheckCircle,
  ClipboardText,
  ClockCountdown,
  GitBranch,
  MagnifyingGlass,
  WarningCircle,
} from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { formatFechaHora, formatMoneda } from '@/lib/dashboard/format';
import type { Aprobacion } from '@/lib/dashboard/queries/aprobaciones';
import type { VerificacionIdentidadActiva } from '@/lib/dashboard/queries/identidad-verificada';
import type { PagoElegible, FacturaElegible } from '@/lib/dashboard/queries/remediation-data';
import type { SlaState } from '@/lib/dashboard/sla-shared';
import type {
  ActivityItem,
  CustomerHealth,
  EscalationLogEntry,
  OrdenResumen,
  TicketDetalle,
  TicketHistorialEntry,
} from '@/lib/dashboard/queries/soporte-workspace';
import type { TareaCaso } from '@/lib/dashboard/queries/tareas';
import type { MajorIncidentSummary } from '@/lib/dashboard/mim-shared';

interface Props {
  ticket: TicketDetalle;
  actividad: ActivityItem[];
  ordenes: OrdenResumen[];
  pagos: PagoElegible[];
  facturas: FacturaElegible[];
  historial: TicketHistorialEntry[];
  tareas: TareaCaso[];
  aprobaciones: Aprobacion[];
  escalations: EscalationLogEntry[];
  customerHealth: CustomerHealth;
  slaState: SlaState | null;
  verificacionIdentidad: VerificacionIdentidadActiva | null;
  mimVinculado: MajorIncidentSummary | null;
  watchersCount: number;
}

type EstadoEvidencia = 'ok' | 'warning' | 'missing';

interface EvidenciaItem {
  key: string;
  label: string;
  value: string;
  state: EstadoEvidencia;
}

const ESTADO_CLASSES: Record<EstadoEvidencia, string> = {
  ok: 'border-success/30 bg-success/5 text-success',
  warning: 'border-warning/30 bg-warning/5 text-warning',
  missing: 'border-destructive/30 bg-destructive/5 text-destructive',
};

const ESTADO_LABEL: Record<EstadoEvidencia, string> = {
  ok: 'Listo',
  warning: 'Revisar',
  missing: 'Falta',
};

const CATEGORIAS_FINANZAS = new Set(['cobro_incorrecto']);
const CATEGORIAS_OPERACIONES = new Set(['no_show']);
const CATEGORIAS_RIESGO = new Set(['dano_propiedad', 'queja_servicio']);
const ESTADOS_TAREA_ABIERTA = new Set(['abierta', 'en_progreso', 'esperando_aprobacion', 'bloqueada']);

function isVerificacionActiva(verificacion: VerificacionIdentidadActiva | null): boolean {
  if (!verificacion) return false;
  return new Date(verificacion.expira_at).getTime() > Date.now();
}

function resumenNotas(actividad: ActivityItem[]) {
  const internas = actividad.filter((a) => a.source === 'mensaje' && a.esInterno).length;
  const publicasAgente = actividad.filter(
    (a) => a.source === 'mensaje' && a.authorTone === 'agent' && !a.esInterno,
  ).length;
  const cliente = actividad.filter((a) => a.source === 'mensaje' && a.authorTone === 'cliente')
    .length;
  return { internas, publicasAgente, cliente };
}

function estadoSla(slaState: SlaState | null): EvidenciaItem {
  if (!slaState) {
    return {
      key: 'sla',
      label: 'SLA',
      value: 'Sin política asignada',
      state: 'warning',
    };
  }
  if (slaState.resuelto_at) {
    return {
      key: 'sla',
      label: 'SLA',
      value: `Resuelto ${formatFechaHora(slaState.resuelto_at)}`,
      state: slaState.breached_ttr ? 'warning' : 'ok',
    };
  }
  return {
    key: 'sla',
    label: 'SLA',
    value: `Vence ${formatFechaHora(slaState.ttr_due_at)}`,
    state: slaState.breached_ttr ? 'missing' : 'ok',
  };
}

function sugerirClasificacion(input: {
  ticket: TicketDetalle;
  customerHealth: CustomerHealth;
  mimVinculado: MajorIncidentSummary | null;
  pagos: PagoElegible[];
  historial: TicketHistorialEntry[];
}): { label: string; reason: string; tone: 'info' | 'warning' | 'destructive' } {
  const { ticket, customerHealth, mimVinculado, pagos, historial } = input;
  const pagosFallidos = pagos.filter((p) => p.estatus === 'fallido').length;
  if (mimVinculado) {
    return {
      label: 'Incidente mayor',
      reason: 'Ya está vinculado a MIM; coordina comunicación y evita respuestas aisladas.',
      tone: 'destructive',
    };
  }
  if (customerHealth.tickets_abiertos >= 3 || historial.length >= 5) {
    return {
      label: 'Problema recurrente',
      reason: 'Hay recurrencia suficiente para buscar causa raíz, no solo cerrar el síntoma.',
      tone: 'warning',
    };
  }
  if (CATEGORIAS_FINANZAS.has(ticket.categoria) && pagosFallidos > 0) {
    return {
      label: 'Incidente financiero',
      reason: 'Hay pagos fallidos recientes; L1 debe derivar evidencia a finanzas si no puede resolver.',
      tone: 'warning',
    };
  }
  return {
    label: 'Incidente individual',
    reason: 'No hay señal fuerte de recurrencia o impacto masivo todavía.',
    tone: 'info',
  };
}

function siguientePaso(input: {
  ticket: TicketDetalle;
  notasInternas: number;
  verificado: boolean;
  tareas: TareaCaso[];
  mimVinculado: MajorIncidentSummary | null;
  watchersCount: number;
}): string {
  const { ticket, notasInternas, verificado, tareas, mimVinculado, watchersCount } = input;
  if (!verificado) return 'L1: verifica identidad antes de tocar datos sensibles o finanzas.';
  if (notasInternas === 0) return 'L1: documenta hipótesis y evidencia mínima en nota interna.';
  if (CATEGORIAS_FINANZAS.has(ticket.categoria) && !tareas.some((t) => t.tipo === 'investigacion_pago')) {
    return 'L1/L2: crea tarea de investigación de pago para finanzas.';
  }
  if (CATEGORIAS_OPERACIONES.has(ticket.categoria) && !tareas.some((t) => t.tipo === 'reasignar_prestador')) {
    return 'L1/L2: crea tarea para operaciones con zona, orden y ventana esperada.';
  }
  if (ticket.estatus === 'escalado' && watchersCount === 0) {
    return 'L2/L3: agrega participantes internos para que el seguimiento no dependa de un solo agente.';
  }
  if (!mimVinculado && ticket.es_major_incident) {
    return 'L2: vincula este ticket al Major Incident correspondiente.';
  }
  return 'Cerrar o escalar solo después de registrar decisión, evidencia y comunicación al cliente.';
}

function etapaItems(input: {
  ticket: TicketDetalle;
  actividad: ActivityItem[];
  ordenes: OrdenResumen[];
  pagos: PagoElegible[];
  facturas: FacturaElegible[];
  tareas: TareaCaso[];
  aprobaciones: Aprobacion[];
  escalations: EscalationLogEntry[];
  verificado: boolean;
  slaState: SlaState | null;
  mimVinculado: MajorIncidentSummary | null;
}) {
  const { internas, publicasAgente, cliente } = resumenNotas(input.actividad);
  const ordenVinculada = input.ticket.orden_id
    ? input.ordenes.find((o) => o.id === input.ticket.orden_id)
    : null;
  const pagosOrden = input.ticket.orden_id
    ? input.pagos.filter((p) => p.orden_id === input.ticket.orden_id)
    : input.pagos;
  const facturasOrden = input.ticket.orden_id
    ? input.facturas.filter((f) => f.orden_id === input.ticket.orden_id)
    : input.facturas;
  const tareasAbiertas = input.tareas.filter((t) => ESTADOS_TAREA_ABIERTA.has(t.estado));
  const aprobacionesPendientes = input.aprobaciones.filter((a) => a.estado === 'solicitada');

  const l1: EvidenciaItem[] = [
    {
      key: 'identidad',
      label: 'Identidad',
      value: input.verificado ? 'Verificada y vigente' : 'Sin verificación vigente',
      state: input.verificado ? 'ok' : 'missing',
    },
    {
      key: 'cliente',
      label: 'Relato cliente',
      value: `${cliente} mensaje(s) del cliente`,
      state: cliente > 0 ? 'ok' : 'missing',
    },
    {
      key: 'orden',
      label: 'Orden',
      value: ordenVinculada
        ? `${ordenVinculada.servicio_nombre} · ${ordenVinculada.estatus}`
        : input.ticket.orden_id
          ? 'Orden no encontrada en recientes'
          : 'Ticket sin orden vinculada',
      state: ordenVinculada ? 'ok' : input.ticket.orden_id ? 'warning' : 'missing',
    },
    {
      key: 'nota',
      label: 'Hipótesis L1',
      value: `${internas} nota(s) internas`,
      state: internas > 0 ? 'ok' : 'missing',
    },
    estadoSla(input.slaState),
  ];

  const l2: EvidenciaItem[] = [
    {
      key: 'pagos',
      label: 'Pagos',
      value: pagosOrden.length > 0
        ? pagosOrden.map((p) => `${p.estatus} ${formatMoneda(p.monto, true)}`).join(' · ')
        : 'Sin pagos recientes',
      state: pagosOrden.some((p) => p.estatus === 'fallido' || p.estatus === 'pendiente')
        ? 'warning'
        : pagosOrden.length > 0
          ? 'ok'
          : 'missing',
    },
    {
      key: 'facturas',
      label: 'CFDI',
      value: facturasOrden.length > 0
        ? facturasOrden.map((f) => `${f.estatus} ${formatMoneda(f.total, true)}`).join(' · ')
        : 'Sin facturas recientes',
      state: facturasOrden.length > 0 ? 'ok' : 'warning',
    },
    {
      key: 'tareas',
      label: 'Tareas área',
      value: `${tareasAbiertas.length} abierta(s)`,
      state: tareasAbiertas.length > 0 ? 'warning' : 'ok',
    },
    {
      key: 'aprobaciones',
      label: 'Aprobaciones',
      value: `${aprobacionesPendientes.length} pendiente(s)`,
      state: aprobacionesPendientes.length > 0 ? 'warning' : 'ok',
    },
  ];

  const l3: EvidenciaItem[] = [
    {
      key: 'escalacion',
      label: 'Escalación',
      value: input.escalations.length > 0
        ? `${input.escalations.length} escalación(es)`
        : 'Sin escalación registrada',
      state: input.ticket.tier_actual === 'l1' ? 'warning' : 'ok',
    },
    {
      key: 'mim',
      label: 'MIM',
      value: input.mimVinculado ? input.mimVinculado.titulo : 'Sin MIM vinculado',
      state: input.mimVinculado ? 'ok' : input.ticket.es_major_incident ? 'missing' : 'warning',
    },
    {
      key: 'cliente-update',
      label: 'Comunicación',
      value: `${publicasAgente} respuesta(s) públicas`,
      state: publicasAgente > 0 ? 'ok' : 'warning',
    },
  ];

  return { l1, l2, l3, notasInternas: internas };
}

function EvidenceList({ items }: { items: EvidenciaItem[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li
          key={item.key}
          className="flex items-start justify-between gap-2 rounded-md border border-border bg-background p-2 text-xs"
        >
          <div className="min-w-0">
            <p className="font-medium">{item.label}</p>
            <p className="truncate text-[11px] text-muted-foreground">{item.value}</p>
          </div>
          <span
            className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${ESTADO_CLASSES[item.state]}`}
          >
            {ESTADO_LABEL[item.state]}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function SupportTriagePanel({
  ticket,
  actividad,
  ordenes,
  pagos,
  facturas,
  historial,
  tareas,
  aprobaciones,
  escalations,
  customerHealth,
  slaState,
  verificacionIdentidad,
  mimVinculado,
  watchersCount,
}: Props) {
  const verificado = isVerificacionActiva(verificacionIdentidad);
  const { l1, l2, l3, notasInternas } = etapaItems({
    ticket,
    actividad,
    ordenes,
    pagos,
    facturas,
    tareas,
    aprobaciones,
    escalations,
    verificado,
    slaState,
    mimVinculado,
  });
  const sugerencia = sugerirClasificacion({
    ticket,
    customerHealth,
    mimVinculado,
    pagos,
    historial,
  });
  const next = siguientePaso({
    ticket,
    notasInternas,
    verificado,
    tareas,
    mimVinculado,
    watchersCount,
  });

  return (
    <Card className="rounded-xl p-4 shadow-none">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <MagnifyingGlass size={16} weight="duotone" className="text-primary" aria-hidden />
            <h2 className="text-sm font-semibold">Triage L1-L3</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Recopila evidencia antes de decidir si es incidente, problema o MIM.
          </p>
        </div>
        <Badge variant={sugerencia.tone}>{sugerencia.label}</Badge>
      </div>

      <div className="mb-4 rounded-md border border-border bg-muted/20 p-3 text-xs">
        <div className="mb-1 flex items-center gap-1.5 font-medium">
          <ClipboardText size={13} aria-hidden />
          Lectura arquitectónica
        </div>
        <p className="text-muted-foreground">{sugerencia.reason}</p>
        <p className="mt-2 font-medium text-foreground">{next}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <section className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <CheckCircle size={13} weight="fill" className="text-success" aria-hidden />
            L1 · Identificar
          </div>
          <EvidenceList items={l1} />
        </section>
        <section className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <GitBranch size={13} weight="duotone" className="text-warning" aria-hidden />
            L2 · Correlacionar
          </div>
          <EvidenceList items={l2} />
        </section>
        <section className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <ArrowUpRight size={13} weight="duotone" className="text-primary" aria-hidden />
            L3 · Causa raíz
          </div>
          <EvidenceList items={l3} />
        </section>
      </div>

      <div className="mt-4 grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-3">
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-background p-2">
          <Books size={12} aria-hidden />
          KB y playbook validan el procedimiento.
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-background p-2">
          <ClockCountdown size={12} aria-hidden />
          SLA decide urgencia, no clasificación.
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-background p-2">
          <WarningCircle size={12} aria-hidden />
          Repetición o impacto masivo eleva a problema/MIM.
        </div>
      </div>
    </Card>
  );
}
