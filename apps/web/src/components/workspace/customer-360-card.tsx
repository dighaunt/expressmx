import { Prohibit, ShieldCheck, Warning } from '@phosphor-icons/react/ssr';
import { formatFechaHora, formatMoneda } from '@/lib/dashboard/format';
import {
  CODIGO_RESOLUCION_LABEL,
  ESTATUS_LABEL,
  TIPO_TICKET_LABEL,
  type EstatusTicket,
  type TipoTicket,
} from '@/lib/dashboard/tickets-shared';
import type {
  ChurnRisk,
  CustomerHealth,
  TicketHistorialEntry,
} from '@/lib/dashboard/queries/soporte-workspace';
import type { SaldoCliente, SaldoMovimiento } from '@/lib/dashboard/queries/saldo-cliente';
import type { SuspensionActiva } from '@/lib/dashboard/queries/suspensiones';
import type { VerificacionIdentidadActiva } from '@/lib/dashboard/queries/identidad-verificada';

interface Props {
  health: CustomerHealth;
  historial?: TicketHistorialEntry[];
  saldo?: SaldoCliente;
  movimientos?: SaldoMovimiento[];
  suspension?: SuspensionActiva | null;
  verificacionIdentidad?: VerificacionIdentidadActiva | null;
}

function diffMinutos(iso: string, ref: number): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.round((t - ref) / 60000));
}

const CHURN_TONE: Record<ChurnRisk, string> = {
  bajo: 'border-success/40 bg-success/5 text-success',
  medio: 'border-warning/40 bg-warning/5 text-warning',
  alto: 'border-destructive/40 bg-destructive/5 text-destructive',
};

const CHURN_LABEL: Record<ChurnRisk, string> = {
  bajo: 'Riesgo de churn: bajo',
  medio: 'Riesgo de churn: medio',
  alto: 'Riesgo de churn: alto',
};

function formatFechaCorta(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function CsatScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 4
      ? 'bg-success/10 text-success'
      : score >= 3
        ? 'bg-warning/10 text-warning'
        : 'bg-destructive/10 text-destructive';
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${tone}`}
    >
      CSAT {score}/5
    </span>
  );
}

export function Customer360Card({
  health,
  historial,
  saldo,
  movimientos,
  suspension,
  verificacionIdentidad,
}: Props) {
  const saldoMxn = saldo ? Number(saldo.saldo_mxn) : 0;
  const ahora = Date.now();
  const verifActiva =
    verificacionIdentidad && new Date(verificacionIdentidad.expira_at).getTime() > ahora
      ? verificacionIdentidad
      : null;
  const haceMin = verifActiva
    ? Math.max(0, Math.round((ahora - new Date(verifActiva.verificado_at).getTime()) / 60000))
    : 0;
  const expiraMin = verifActiva ? diffMinutos(verifActiva.expira_at, ahora) : 0;
  return (
    <div className="space-y-3">
      {verifActiva ? (
        <div className="flex items-start gap-2 rounded-md border border-success/40 bg-success/5 px-2 py-1.5 text-success">
          <ShieldCheck size={12} weight="fill" aria-hidden className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide">
              Identidad verificada por @{verifActiva.verificado_por_nombre.trim()}
            </p>
            <p className="text-[10px] opacity-80">
              hace {haceMin} min · expira en {expiraMin} min
              {verifActiva.metodo === 'transferida' ? ' · transferida' : ''}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-md border border-dashed border-border bg-background px-2 py-1.5 text-muted-foreground">
          <ShieldCheck size={12} aria-hidden className="shrink-0" />
          <span className="text-[10px] uppercase tracking-wide">
            Sin verificación de identidad activa
          </span>
        </div>
      )}

      {suspension ? (
        <div className="flex items-start gap-2 rounded-md border-l-4 border-destructive bg-destructive/10 px-2 py-1.5 text-destructive">
          <Prohibit size={12} weight="fill" aria-hidden className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide">
              Cuenta suspendida · {suspension.motivo.replace(/_/g, ' ')}
            </p>
            <p className="text-[10px] opacity-80">
              {suspension.ventana_fin
                ? `Hasta ${formatFechaHora(suspension.ventana_fin)}`
                : 'Indefinida'}
              {' · por '}
              {suspension.creada_por_nombre}
            </p>
          </div>
        </div>
      ) : null}

      {saldo ? (
        <div className="flex items-center justify-between rounded-md border border-border bg-background px-2 py-1.5">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Saldo en cuenta
          </span>
          <span
            className={`tabular-nums text-sm font-semibold ${saldoMxn > 0 ? 'text-success' : saldoMxn < 0 ? 'text-destructive' : 'text-foreground'}`}
          >
            {formatMoneda(saldo.saldo_mxn, true)}
          </span>
        </div>
      ) : null}

      <div
        className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${CHURN_TONE[health.churn_risk]}`}
      >
        {health.churn_risk !== 'bajo' ? <Warning size={12} aria-hidden /> : null}
        <span className="text-[10px] uppercase tracking-wide font-medium">
          {CHURN_LABEL[health.churn_risk]}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <dt className="text-muted-foreground">Tickets totales</dt>
        <dd className="text-right tabular-nums">{health.total_tickets}</dd>
        <dt className="text-muted-foreground">Abiertos ahora</dt>
        <dd className="text-right tabular-nums">{health.tickets_abiertos}</dd>
        <dt className="text-muted-foreground">Cerrados 30d</dt>
        <dd className="text-right tabular-nums">
          {health.tickets_cerrados_30d}
        </dd>
        <dt className="text-muted-foreground">CSAT 90d</dt>
        <dd className="text-right tabular-nums">
          {health.csat_promedio_90d !== null
            ? health.csat_promedio_90d.toFixed(1)
            : '—'}
        </dd>
        <dt className="text-muted-foreground">Órdenes</dt>
        <dd className="text-right tabular-nums">{health.total_ordenes}</dd>
        <dt className="text-muted-foreground">Total gastado</dt>
        <dd className="text-right tabular-nums">
          {formatMoneda(health.total_gastado_mxn, true)}
        </dd>
      </dl>
      {movimientos && movimientos.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground">
            Movimientos saldo
          </p>
          <ul className="space-y-1">
            {movimientos.slice(0, 5).map((m) => {
              const monto = Number(m.monto_mxn);
              return (
                <li
                  key={m.id}
                  className="rounded-md border border-border bg-background px-2 py-1 text-[11px]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-muted-foreground">
                      {m.tipo.replace(/_/g, ' ')}
                    </span>
                    <span
                      className={`tabular-nums font-medium ${monto > 0 ? 'text-success' : monto < 0 ? 'text-destructive' : ''}`}
                    >
                      {monto > 0 ? '+' : ''}
                      {formatMoneda(m.monto_mxn, true)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                    {formatFechaHora(m.created_at)} · {m.creado_por_nombre}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {historial && historial.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground">
            Historial reciente
          </p>
          <ul className="space-y-1.5">
            {historial.map((t) => {
              const codigoLabel =
                t.resolucion_codigo && t.resolucion_codigo in CODIGO_RESOLUCION_LABEL
                  ? CODIGO_RESOLUCION_LABEL[t.resolucion_codigo]
                  : null;
              const estatusLabel =
                t.estatus in ESTATUS_LABEL
                  ? ESTATUS_LABEL[t.estatus as EstatusTicket]
                  : t.estatus;
              const tipoLabel =
                t.tipo in TIPO_TICKET_LABEL
                  ? TIPO_TICKET_LABEL[t.tipo as TipoTicket]
                  : t.tipo;
              return (
                <li
                  key={t.id}
                  className="rounded-md border border-border bg-background p-2 text-[11px]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{t.asunto}</span>
                    {t.csat_score !== null ? (
                      <CsatScoreBadge score={t.csat_score} />
                    ) : null}
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2 text-muted-foreground">
                    <span className="truncate">
                      {tipoLabel} · {estatusLabel}
                      {codigoLabel ? ` · ${codigoLabel}` : ''}
                    </span>
                    <span className="tabular-nums">
                      {formatFechaCorta(t.cerrado_at ?? t.created_at)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
