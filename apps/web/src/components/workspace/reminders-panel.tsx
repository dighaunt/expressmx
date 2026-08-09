'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BellSlash, BellRinging, CheckCircle, XCircle } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { cancelarRecordatorio } from '@/lib/dashboard/actions/recordatorios';
import type { RecordatorioRow, TipoRecordatorio } from '@/lib/dashboard/queries/recordatorios';
import { formatFechaHora } from '@/lib/dashboard/format';

interface Props {
  recordatorios: ReadonlyArray<RecordatorioRow>;
}

const TIPO_LABEL: Record<TipoRecordatorio, string> = {
  callback_cliente: 'Callback cliente',
  follow_up_interno: 'Seguimiento',
  reabrir_ticket: 'Reabrir ticket',
  ejecutar_tarea: 'Ejecutar tarea',
};

type EstadoRow = 'pendiente' | 'disparado' | 'cancelado';

function estadoDe(r: RecordatorioRow): EstadoRow {
  if (r.cancelado_at) return 'cancelado';
  if (r.disparado_at) return 'disparado';
  return 'pendiente';
}

function CancelButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);

  if (confirm) {
    return (
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const r = await cancelarRecordatorio({ recordatorioId: id });
              if (r.ok) {
                toast.success('Recordatorio cancelado');
                router.refresh();
              } else {
                toast.error(r.message ?? 'No pudimos cancelar');
              }
            });
          }}
          className="rounded-md border border-destructive/40 bg-destructive/5 px-2 py-0.5 text-[11px] font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
        >
          {pending ? '...' : 'Confirmar'}
        </button>
        <button
          type="button"
          onClick={() => setConfirm(false)}
          disabled={pending}
          className="rounded-md border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted/40"
        >
          No
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirm(true)}
      className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted/40"
    >
      Cancelar
    </button>
  );
}

export function RemindersPanel({ recordatorios }: Props) {
  if (recordatorios.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">Sin recordatorios programados.</p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {recordatorios.map((r) => {
        const estado = estadoDe(r);
        const tone =
          estado === 'pendiente'
            ? 'border-border bg-background'
            : estado === 'disparado'
              ? 'border-success/30 bg-success/5'
              : 'border-border bg-muted/30 opacity-70';
        const Icon =
          estado === 'pendiente' ? BellRinging : estado === 'disparado' ? CheckCircle : XCircle;
        const iconTone =
          estado === 'pendiente'
            ? 'text-primary'
            : estado === 'disparado'
              ? 'text-success'
              : 'text-muted-foreground';
        return (
          <li
            key={r.id}
            className={`rounded-md border p-2 text-xs ${tone}`}
          >
            <div className="flex items-start gap-2">
              <Icon size={14} aria-hidden className={`mt-0.5 shrink-0 ${iconTone}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{r.asunto}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {TIPO_LABEL[r.tipo] ?? r.tipo}
                  {r.para_user_nombre ? ` · ${r.para_user_nombre}` : ''}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {estado === 'disparado' && r.disparado_at
                    ? `Disparado ${formatFechaHora(r.disparado_at)}`
                    : estado === 'cancelado' && r.cancelado_at
                      ? `Cancelado ${formatFechaHora(r.cancelado_at)}`
                      : `Disparar ${formatFechaHora(r.disparar_at)}`}
                </p>
                {r.notas_md ? (
                  <p className="mt-1 line-clamp-2 text-[11px] text-foreground">{r.notas_md}</p>
                ) : null}
              </div>
              {estado === 'pendiente' ? (
                <CancelButton id={r.id} />
              ) : estado === 'cancelado' ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  <BellSlash size={11} aria-hidden /> cancelado
                </span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
