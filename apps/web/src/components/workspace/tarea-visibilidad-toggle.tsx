'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { setTareaVisibilidadCliente } from '@/lib/dashboard/actions/tareas-caso';

interface Props {
  tareaId: string;
  visible: boolean;
  tituloCliente: string | null;
  asuntoInterno: string;
}

export function TareaVisibilidadToggle({
  tareaId,
  visible,
  tituloCliente,
  asuntoInterno,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [titulo, setTitulo] = useState(tituloCliente ?? asuntoInterno);

  function ocultar() {
    startTransition(async () => {
      const r = await setTareaVisibilidadCliente({
        tareaId,
        visible: false,
        tituloCliente: null,
      });
      if (r.ok) {
        toast.success('Tarea ocultada al cliente');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos actualizar la visibilidad');
      }
    });
  }

  function mostrar() {
    const t = titulo.trim();
    if (t.length < 3) {
      toast.error('Título visible al cliente mínimo 3 caracteres');
      return;
    }
    startTransition(async () => {
      const r = await setTareaVisibilidadCliente({
        tareaId,
        visible: true,
        tituloCliente: t,
      });
      if (r.ok) {
        toast.success('Tarea visible al cliente');
        setEditing(false);
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos actualizar la visibilidad');
      }
    });
  }

  if (visible) {
    return (
      <button
        type="button"
        onClick={ocultar}
        disabled={pending}
        className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium hover:bg-muted/40 disabled:opacity-50"
      >
        {pending ? '...' : 'Ocultar al cliente'}
      </button>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        disabled={pending}
        className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium hover:bg-muted/40 disabled:opacity-50"
      >
        Hacer visible al cliente
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-1.5 rounded-md border border-border bg-background p-2">
      <label className="block space-y-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Título visible al cliente
        </span>
        <textarea
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          rows={2}
          maxLength={160}
          placeholder="Ej. Validando tu pago con el banco"
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[11px] outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
      </label>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setTitulo(tituloCliente ?? asuntoInterno);
          }}
          disabled={pending}
          className="rounded-md border border-border px-2 py-0.5 text-[10px] font-medium hover:bg-muted/40 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={mostrar}
          disabled={pending}
          className="rounded-md border border-primary bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? 'Guardando...' : 'Mostrar al cliente'}
        </button>
      </div>
    </div>
  );
}
