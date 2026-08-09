'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, PaperPlaneRight, UserPlus } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { CannedResponsePicker } from '@/components/workspace/canned-response-picker';
import { InternalNoteToggle } from '@/components/workspace/internal-note-toggle';
import {
  asignarmeTicket,
  cambiarEstatusTicket,
  cambiarPrioridadTicket,
  responderTicket,
} from '@/lib/dashboard/actions/tickets';
import type {
  CannedResponseSummary,
  CannedVariableContext,
} from '@/lib/dashboard/canned-shared';
import {
  ESTATUS_LABEL,
  PRIORIDAD_LABEL,
  type EstatusTicket,
  type PrioridadTicket,
} from '@/lib/dashboard/tickets-shared';

interface Props {
  ticketId: string;
  estatus: EstatusTicket;
  prioridad: PrioridadTicket;
  agenteId: string | null;
  viewerId: string;
  cannedResponses?: ReadonlyArray<CannedResponseSummary>;
  cannedContext?: CannedVariableContext;
}

export function TicketWorkspaceForm({
  ticketId,
  estatus,
  prioridad,
  agenteId,
  viewerId,
  cannedResponses = [],
  cannedContext = {},
}: Props) {
  const router = useRouter();
  const [respuesta, setRespuesta] = useState('');
  const [resolver, setResolver] = useState(false);
  const [esInterno, setEsInterno] = useState(false);
  const [cannedId, setCannedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const esMio = agenteId === viewerId;

  function handleResponder() {
    if (respuesta.trim().length === 0) {
      toast.error('Escribe la respuesta antes de enviar');
      return;
    }
    if (esInterno && resolver) {
      toast.error('Una nota interna no puede resolver el ticket');
      return;
    }
    startTransition(async () => {
      const r = await responderTicket(ticketId, respuesta, {
        resolver,
        esInterno,
        cannedResponseId: cannedId,
      });
      if (r.ok) {
        toast.success(
          esInterno
            ? 'Nota interna guardada'
            : resolver
              ? 'Respuesta enviada y ticket resuelto'
              : 'Respuesta enviada',
        );
        setRespuesta('');
        setResolver(false);
        setEsInterno(false);
        setCannedId(null);
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos enviar');
      }
    });
  }

  function handleAsignarme() {
    startTransition(async () => {
      const r = await asignarmeTicket(ticketId);
      if (r.ok) {
        toast.success('Te asignaste el ticket');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos asignar');
      }
    });
  }

  function handlePrioridad(next: PrioridadTicket) {
    startTransition(async () => {
      const r = await cambiarPrioridadTicket(ticketId, next);
      if (r.ok) {
        toast.success('Prioridad actualizada');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos actualizar');
      }
    });
  }

  function handleEstatus(next: EstatusTicket) {
    startTransition(async () => {
      const r = await cambiarEstatusTicket(ticketId, next);
      if (r.ok) {
        toast.success('Estatus actualizado');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos actualizar');
      }
    });
  }

  function handlePickCanned(resolved: string, id: string) {
    setRespuesta((prev) => (prev.trim().length === 0 ? resolved : `${prev}\n\n${resolved}`));
    setCannedId(id);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Estatus
          </label>
          <select
            value={estatus}
            onChange={(e) => handleEstatus(e.target.value as EstatusTicket)}
            disabled={pending}
            className={inputClass}
          >
            {(Object.keys(ESTATUS_LABEL) as EstatusTicket[]).map((s) => (
              <option key={s} value={s}>
                {ESTATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Prioridad
          </label>
          <select
            value={prioridad}
            onChange={(e) => handlePrioridad(e.target.value as PrioridadTicket)}
            disabled={pending}
            className={inputClass}
          >
            {(Object.keys(PRIORIDAD_LABEL) as PrioridadTicket[]).map((p) => (
              <option key={p} value={p}>
                {PRIORIDAD_LABEL[p]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!esMio ? (
        <button
          type="button"
          onClick={handleAsignarme}
          disabled={pending}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 text-sm font-medium text-primary hover:bg-primary/20 disabled:opacity-60"
        >
          <UserPlus size={14} aria-hidden /> Asignármelo
        </button>
      ) : null}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {esInterno ? 'Nota interna' : 'Responder'}
          </label>
          <div className="flex items-center gap-2">
            <InternalNoteToggle
              value={esInterno}
              onChange={(v) => {
                setEsInterno(v);
                if (v) setResolver(false);
              }}
              disabled={pending}
            />
            <CannedResponsePicker
              cannedResponses={cannedResponses}
              context={cannedContext}
              onPick={handlePickCanned}
              disabled={pending}
            />
          </div>
        </div>
        <textarea
          value={respuesta}
          onChange={(e) => setRespuesta(e.target.value)}
          rows={4}
          maxLength={4000}
          placeholder={
            esInterno
              ? 'Notas para el equipo (no se envían al cliente).'
              : 'Escribe la respuesta para el cliente.'
          }
          className={
            esInterno
              ? 'w-full rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-sm outline-none focus:border-warning focus:ring-2 focus:ring-warning/20'
              : 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20'
          }
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label
            className={`flex items-center gap-2 text-xs ${
              esInterno ? 'opacity-50' : 'text-muted-foreground'
            }`}
          >
            <input
              type="checkbox"
              checked={resolver}
              onChange={(e) => setResolver(e.target.checked)}
              disabled={esInterno}
              className="size-4 accent-primary"
            />
            Marcar como resuelto al enviar
          </label>
          <button
            type="button"
            onClick={handleResponder}
            disabled={pending || respuesta.trim().length === 0}
            className={
              esInterno
                ? 'inline-flex h-9 items-center gap-1.5 rounded-md border border-warning/40 bg-warning/10 px-3 text-sm font-medium text-warning hover:bg-warning/20 disabled:opacity-60'
                : 'inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60'
            }
          >
            {resolver ? (
              <CheckCircle size={14} aria-hidden />
            ) : (
              <PaperPlaneRight size={14} aria-hidden />
            )}
            {pending
              ? 'Enviando…'
              : esInterno
                ? 'Guardar nota'
                : resolver
                  ? 'Resolver y enviar'
                  : 'Enviar respuesta'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  'h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-60';
