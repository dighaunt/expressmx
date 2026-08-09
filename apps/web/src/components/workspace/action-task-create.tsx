'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { crearTarea } from '@/lib/dashboard/actions/tareas-caso';

const TIPOS = [
  { value: 'follow_up_interno', label: 'Seguimiento interno', grupo: 'soporte_l1' },
  { value: 'callback_cliente', label: 'Callback cliente', grupo: 'soporte_l1' },
  { value: 'verificacion_id', label: 'Verificar identidad', grupo: 'soporte_l1' },
  { value: 'investigacion_pago', label: 'Investigar pago', grupo: 'finanzas_l2' },
  { value: 'reasignar_prestador', label: 'Reasignar prestador', grupo: 'operaciones_l1' },
] as const;

type Tipo = (typeof TIPOS)[number]['value'];

interface Props {
  ticketId: string;
}

export function ActionTaskCreate({ ticketId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [tipo, setTipo] = useState<Tipo>('follow_up_interno');
  const [asunto, setAsunto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [bloqueante, setBloqueante] = useState(false);
  const [visibleCliente, setVisibleCliente] = useState(false);
  const [tituloCliente, setTituloCliente] = useState('');

  function handleSubmit() {
    const a = asunto.trim();
    if (a.length < 3) {
      toast.error('Asunto mínimo 3 caracteres');
      return;
    }
    const tc = tituloCliente.trim();
    if (visibleCliente && tc.length < 3) {
      toast.error('Título visible al cliente mínimo 3 caracteres');
      return;
    }
    startTransition(async () => {
      const r = await crearTarea({
        ticketId,
        tipo,
        asunto: a,
        descripcion: descripcion.trim() || undefined,
        bloqueante,
        visibleCliente,
        tituloCliente: visibleCliente ? tc : null,
      });
      if (r.ok) {
        toast.success('Tarea creada');
        setOpen(false);
        setAsunto('');
        setDescripcion('');
        setBloqueante(false);
        setVisibleCliente(false);
        setTituloCliente('');
        setTipo('follow_up_interno');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos crear la tarea');
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
        <Plus size={14} aria-hidden />
        <span className="flex-1">Crear tarea</span>
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-border bg-background p-3 text-sm">
      <p className="text-xs font-medium text-muted-foreground">Nueva tarea</p>

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
              {t.label} → {t.grupo}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Asunto
        </span>
        <input
          value={asunto}
          onChange={(e) => setAsunto(e.target.value)}
          maxLength={160}
          placeholder="Describe brevemente qué se necesita"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Detalle (opcional)
        </span>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={3}
          maxLength={2000}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
      </label>

      <label className="flex items-center gap-2 text-[11px] text-foreground">
        <input
          type="checkbox"
          checked={bloqueante}
          onChange={(e) => setBloqueante(e.target.checked)}
          className="rounded border-border"
        />
        <span>Bloqueante (impide cerrar el ticket)</span>
      </label>

      <div className="rounded-md border border-border bg-muted/20 p-2 space-y-2">
        <button
          type="button"
          role="switch"
          aria-checked={visibleCliente}
          onClick={() => setVisibleCliente((v) => !v)}
          className="flex w-full items-center justify-between gap-2 text-left text-[11px] font-medium text-foreground"
        >
          <span>Visible al cliente</span>
          <span
            className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full border transition-colors ${
              visibleCliente ? 'border-primary bg-primary' : 'border-border bg-background'
            }`}
            aria-hidden
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-background shadow transition-transform ${
                visibleCliente ? 'translate-x-3 bg-primary-foreground' : 'translate-x-0.5'
              }`}
            />
          </span>
        </button>
        {visibleCliente ? (
          <label className="block space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Título visible al cliente
            </span>
            <textarea
              value={tituloCliente}
              onChange={(e) => setTituloCliente(e.target.value)}
              rows={2}
              maxLength={160}
              placeholder="Ej. Validando tu pago con el banco"
              required
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
            <span className="text-[10px] text-muted-foreground">
              El cliente verá este texto, no el asunto interno.
            </span>
          </label>
        ) : null}
      </div>

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
          {pending ? 'Creando...' : 'Crear tarea'}
        </button>
      </div>
    </div>
  );
}
