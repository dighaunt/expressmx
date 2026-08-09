'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BellRinging } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { crearRecordatorio } from '@/lib/dashboard/actions/recordatorios';

const TIPOS = [
  { value: 'callback_cliente', label: 'Callback al cliente' },
  { value: 'follow_up_interno', label: 'Seguimiento interno' },
  { value: 'reabrir_ticket', label: 'Reabrir ticket' },
  { value: 'ejecutar_tarea', label: 'Ejecutar tarea' },
] as const;

type Tipo = (typeof TIPOS)[number]['value'];

interface Props {
  ticketId: string;
}

const QUICK_OFFSETS_MIN = [
  { label: '+15m', value: 15 },
  { label: '+1h', value: 60 },
  { label: '+4h', value: 240 },
  { label: '+24h', value: 60 * 24 },
];

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ActionReminderCreate({ ticketId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [tipo, setTipo] = useState<Tipo>('callback_cliente');
  const [asunto, setAsunto] = useState('');
  const [notas, setNotas] = useState('');
  const defaultLocal = useMemo(() => {
    const d = new Date(Date.now() + 60 * 60_000);
    d.setSeconds(0, 0);
    return toLocalInputValue(d);
  }, []);
  const [dispararLocal, setDispararLocal] = useState(defaultLocal);

  function applyOffset(min: number) {
    const d = new Date(Date.now() + min * 60_000);
    d.setSeconds(0, 0);
    setDispararLocal(toLocalInputValue(d));
  }

  function handleSubmit() {
    const a = asunto.trim();
    if (a.length < 3) {
      toast.error('Asunto mínimo 3 caracteres');
      return;
    }
    const local = new Date(dispararLocal);
    if (Number.isNaN(local.getTime())) {
      toast.error('Fecha inválida');
      return;
    }
    if (local.getTime() - Date.now() < 5 * 60_000) {
      toast.error('Programa al menos 5 minutos en el futuro');
      return;
    }

    startTransition(async () => {
      const r = await crearRecordatorio({
        ticketId,
        tipo,
        dispararAt: local.toISOString(),
        asunto: a,
        notasMd: notas.trim() || undefined,
      });
      if (r.ok) {
        toast.success('Recordatorio programado');
        setOpen(false);
        setAsunto('');
        setNotas('');
        setTipo('callback_cliente');
        setDispararLocal(defaultLocal);
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos programar el recordatorio');
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-left text-sm font-medium hover:bg-muted/40"
      >
        <BellRinging size={14} aria-hidden />
        <span className="flex-1">Programar recordatorio</span>
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-border bg-background p-3 text-sm">
      <p className="text-xs font-medium text-muted-foreground">Nuevo recordatorio</p>

      <label className="block space-y-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Tipo
        </span>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as Tipo)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        >
          {TIPOS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Disparar el
        </span>
        <input
          type="datetime-local"
          value={dispararLocal}
          onChange={(e) => setDispararLocal(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
        <div className="flex flex-wrap gap-1.5 pt-1">
          {QUICK_OFFSETS_MIN.map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => applyOffset(o.value)}
              className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted/40"
            >
              {o.label}
            </button>
          ))}
        </div>
      </label>

      <label className="block space-y-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Asunto
        </span>
        <input
          value={asunto}
          onChange={(e) => setAsunto(e.target.value)}
          maxLength={160}
          placeholder="Llamar al cliente para confirmar reembolso"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Notas (opcional)
        </span>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={3}
          maxLength={2000}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
      </label>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/40"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending}
          className="rounded-md border border-primary bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? 'Programando...' : 'Programar'}
        </button>
      </div>
    </div>
  );
}
