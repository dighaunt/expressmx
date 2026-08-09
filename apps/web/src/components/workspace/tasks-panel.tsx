import Link from 'next/link';
import { CheckCircle, ClockCountdown, Lock, XCircle } from '@phosphor-icons/react/ssr';
import { formatFechaHora } from '@/lib/dashboard/format';
import type {
  EstadoTareaCaso,
  TareaCaso,
  TipoTareaCaso,
} from '@/lib/dashboard/queries/tareas';
import { TareaVisibilidadToggle } from './tarea-visibilidad-toggle';

interface Props {
  tareas: TareaCaso[];
  puedeEditarVisibilidad?: boolean;
}

const TIPO_LABEL: Record<TipoTareaCaso, string> = {
  reembolso: 'Reembolso',
  cfdi_cancelacion: 'CFDI cancelación',
  cfdi_reemision: 'CFDI reemisión',
  credito_aplicacion: 'Aplicar crédito',
  reasignar_prestador: 'Reasignar prestador',
  investigacion_pago: 'Investigar pago',
  callback_cliente: 'Callback cliente',
  verificacion_id: 'Verificar identidad',
  follow_up_interno: 'Seguimiento interno',
};

const ESTADO_TONE: Record<EstadoTareaCaso, string> = {
  abierta: 'bg-info/10 text-info-foreground border-info/30',
  en_progreso: 'bg-warning/10 text-warning-foreground border-warning/30',
  esperando_aprobacion: 'bg-amber-100 text-amber-900 border-amber-300',
  bloqueada: 'bg-destructive/10 text-destructive border-destructive/30',
  completada: 'bg-success/10 text-success border-success/30',
  cancelada: 'bg-muted text-muted-foreground border-border',
};

const ESTADO_LABEL: Record<EstadoTareaCaso, string> = {
  abierta: 'Abierta',
  en_progreso: 'En progreso',
  esperando_aprobacion: 'Esperando aprobación',
  bloqueada: 'Bloqueada',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

function EstadoIcon({ estado }: { estado: EstadoTareaCaso }) {
  if (estado === 'completada') return <CheckCircle size={12} weight="fill" aria-hidden />;
  if (estado === 'cancelada') return <XCircle size={12} weight="fill" aria-hidden />;
  if (estado === 'bloqueada') return <Lock size={12} weight="fill" aria-hidden />;
  return <ClockCountdown size={12} aria-hidden />;
}

export function TasksPanel({ tareas, puedeEditarVisibilidad = false }: Props) {
  if (tareas.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border bg-background p-3 text-xs text-muted-foreground">
        Sin tareas todavía. Crea una para coordinar con finanzas, operaciones o legal.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {tareas.map((t) => (
        <li
          key={t.id}
          className="rounded-md border border-border bg-background p-2 text-xs"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium">{t.asunto}</span>
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${ESTADO_TONE[t.estado]}`}
            >
              <EstadoIcon estado={t.estado} />
              {ESTADO_LABEL[t.estado]}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-muted-foreground">
            <span className="truncate">
              {TIPO_LABEL[t.tipo]} · {t.grupo_asignado}
              {t.bloqueante ? ' · bloqueante' : ''}
            </span>
            {t.vence_at ? (
              <span className="tabular-nums">{formatFechaHora(t.vence_at)}</span>
            ) : null}
          </div>
          {t.asignado_nombre ? (
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Asignada a {t.asignado_nombre}
            </p>
          ) : null}
          {t.visible_cliente || puedeEditarVisibilidad ? (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {t.visible_cliente ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-info/30 bg-info/10 px-1.5 py-0.5 text-[10px] font-medium text-info-foreground">
                  Visible al cliente
                </span>
              ) : null}
              {t.visible_cliente && t.titulo_cliente ? (
                <span className="truncate text-[10px] text-muted-foreground">
                  “{t.titulo_cliente}”
                </span>
              ) : null}
              {puedeEditarVisibilidad ? (
                <TareaVisibilidadToggle
                  tareaId={t.id}
                  visible={t.visible_cliente}
                  tituloCliente={t.titulo_cliente}
                  asuntoInterno={t.asunto}
                />
              ) : null}
            </div>
          ) : null}
          {t.resultado_md && (t.estado === 'completada' || t.estado === 'cancelada') ? (
            <p className="mt-1 whitespace-pre-wrap rounded-md border-l-2 border-border bg-muted/30 px-2 py-1 text-[11px] text-foreground">
              {t.resultado_md}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
