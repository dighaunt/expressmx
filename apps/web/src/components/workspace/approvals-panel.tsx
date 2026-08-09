import { CheckCircle, Hourglass, XCircle } from '@phosphor-icons/react/ssr';
import { formatFechaHora, formatMoneda } from '@/lib/dashboard/format';
import type {
  Aprobacion,
  EstadoAprobacion,
} from '@/lib/dashboard/queries/aprobaciones';

interface Props {
  aprobaciones: Aprobacion[];
}

const ESTADO_TONE: Record<EstadoAprobacion, string> = {
  solicitada: 'bg-amber-100 text-amber-900 border-amber-300',
  aprobada: 'bg-success/10 text-success border-success/30',
  rechazada: 'bg-destructive/10 text-destructive border-destructive/30',
  cancelada: 'bg-muted text-muted-foreground border-border',
  expirada: 'bg-muted text-muted-foreground border-border',
};

const ESTADO_LABEL: Record<EstadoAprobacion, string> = {
  solicitada: 'Solicitada',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
  expirada: 'Expirada',
};

const ENTIDAD_LABEL = {
  reembolsos: 'Reembolso',
  tareas_caso: 'Tarea',
  saldo_cliente_movimientos: 'Crédito',
  suspensiones_cuenta: 'Suspensión',
} as const;

function EstadoIcon({ estado }: { estado: EstadoAprobacion }) {
  if (estado === 'aprobada') return <CheckCircle size={12} weight="fill" aria-hidden />;
  if (estado === 'rechazada' || estado === 'cancelada' || estado === 'expirada')
    return <XCircle size={12} weight="fill" aria-hidden />;
  return <Hourglass size={12} aria-hidden />;
}

export function ApprovalsPanel({ aprobaciones }: Props) {
  if (aprobaciones.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border bg-background p-3 text-xs text-muted-foreground">
        Sin aprobaciones registradas para este ticket.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {aprobaciones.map((a) => (
        <li
          key={a.id}
          className="rounded-md border border-border bg-background p-2 text-xs"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">
              {ENTIDAD_LABEL[a.entidad]}
              {a.monto_mxn ? ` · ${formatMoneda(a.monto_mxn, true)}` : ''}
            </span>
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${ESTADO_TONE[a.estado]}`}
            >
              <EstadoIcon estado={a.estado} />
              {ESTADO_LABEL[a.estado]}
            </span>
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Aprueba {a.aprobador_grupo}
            {a.aprobador_nombre ? ` · decidió ${a.aprobador_nombre}` : ''}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-[11px] text-foreground">
            {a.motivo_md}
          </p>
          {a.notas_decision_md ? (
            <p className="mt-1 whitespace-pre-wrap rounded-md border-l-2 border-border bg-muted/30 px-2 py-1 text-[11px]">
              <span className="font-medium">Decisión:</span> {a.notas_decision_md}
            </p>
          ) : null}
          <p className="mt-1 text-[10px] text-muted-foreground">
            Solicitada por {a.solicitado_por_nombre} · {formatFechaHora(a.created_at)}
            {a.estado === 'solicitada' ? ` · expira ${formatFechaHora(a.expira_at)}` : ''}
          </p>
        </li>
      ))}
    </ul>
  );
}
