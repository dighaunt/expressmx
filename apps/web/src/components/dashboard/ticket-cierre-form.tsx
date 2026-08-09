'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { cerrarTicket } from '@/lib/dashboard/actions/tickets-cerrar';
import {
  CODIGO_RESOLUCION_LABEL,
  type CodigoResolucion,
} from '@/lib/dashboard/tickets-shared';

interface Props {
  ticketId: string;
}

const CODIGOS: ReadonlyArray<CodigoResolucion> = [
  'resuelto_directo',
  'kb_resuelto',
  'reembolso_emitido',
  'duplicado',
  'no_aplica',
  'no_reproducible',
  'sin_respuesta_cliente',
];

export function TicketCierreForm({ ticketId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [codigo, setCodigo] = useState<CodigoResolucion>('resuelto_directo');
  const [notas, setNotas] = useState('');
  const [pending, startTransition] = useTransition();

  function submit() {
    if (notas.trim().length < 20) {
      toast.error('Las notas deben tener al menos 20 caracteres');
      return;
    }
    startTransition(async () => {
      const r = await cerrarTicket({ ticketId, codigo, notas });
      if (r.ok) {
        toast.success('Ticket cerrado');
        setOpen(false);
        setCodigo('resuelto_directo');
        setNotas('');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos cerrar el ticket');
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-md border border-success/40 bg-success/5 px-3 py-2 text-left text-sm font-medium text-success hover:bg-success/10"
      >
        <CheckCircle size={14} aria-hidden />
        <span className="flex-1">Cerrar ticket</span>
      </button>
    );
  }

  const longitudActual = notas.trim().length;

  return (
    <div className="space-y-3 rounded-md border border-success/40 bg-success/5 p-3 text-sm">
      <p className="text-xs font-medium text-success">Cerrar ticket</p>
      <label className="block space-y-1">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Código de resolución
        </span>
        <select
          value={codigo}
          onChange={(e) => setCodigo(e.target.value as CodigoResolucion)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs"
        >
          {CODIGOS.map((k) => (
            <option key={k} value={k}>
              {CODIGO_RESOLUCION_LABEL[k]}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Notas de resolución{' '}
          <span className="normal-case text-muted-foreground">
            ({longitudActual}/20 mínimo)
          </span>
        </span>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Describe la resolución. Estas notas quedan en auditoría y se muestran al cliente con el cierre."
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
      </label>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setNotas('');
          }}
          className="h-8 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted"
        >
          Atrás
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending || longitudActual < 20}
          className="h-8 rounded-md bg-success px-3 text-xs font-medium text-success-foreground hover:bg-success/90 disabled:opacity-60"
        >
          {pending ? 'Cerrando…' : 'Confirmar cierre'}
        </button>
      </div>
    </div>
  );
}
