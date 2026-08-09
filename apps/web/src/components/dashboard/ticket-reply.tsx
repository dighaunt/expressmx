'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { responderTicket } from '@/lib/dashboard/actions/tickets';

interface Props {
  ticketId: string;
  estatus: string;
}

export function TicketReply({ ticketId, estatus }: Props) {
  const router = useRouter();
  const [contenido, setContenido] = useState('');
  const [pending, startTransition] = useTransition();

  if (estatus === 'resuelto') {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
        Este ticket está resuelto. Cambia el estatus para volver a responder.
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent, resolver: boolean) {
    e.preventDefault();
    if (contenido.trim().length === 0) return;
    startTransition(async () => {
      const r = await responderTicket(ticketId, contenido, resolver);
      if (r.ok) {
        toast.success(resolver ? 'Respondido y marcado como resuelto' : 'Respuesta enviada');
        setContenido('');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos enviar tu respuesta');
      }
    });
  }

  return (
    <form className="space-y-2 rounded-xl border border-border bg-card p-4">
      <textarea
        value={contenido}
        onChange={(e) => setContenido(e.target.value)}
        rows={4}
        maxLength={4000}
        placeholder="Escribe tu respuesta. El cliente la verá en su app o por correo."
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
      />
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="submit"
          onClick={(e) => handleSubmit(e, true)}
          disabled={pending || contenido.trim().length === 0}
          className="h-9 rounded-md border border-success/40 bg-success/10 px-3 text-sm font-medium text-success hover:bg-success/20 disabled:opacity-60"
        >
          Responder y resolver
        </button>
        <button
          type="submit"
          onClick={(e) => handleSubmit(e, false)}
          disabled={pending || contenido.trim().length === 0}
          className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? 'Enviando…' : 'Responder'}
        </button>
      </div>
    </form>
  );
}
