'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Star, UserPlus } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import {
  asignarOrden,
  reasignarOrden,
} from '@/lib/dashboard/actions/operaciones';
import { cn } from '@/lib/utils';

interface Candidato {
  id: string;
  nombre: string;
  email: string;
  rating: string | null;
  ordenes_completadas: number;
  ofrece_servicio: boolean;
  distancia_km: string | null;
}

interface Props {
  ordenId: string;
  estatus: string;
  prestadorActualId: string | null;
  candidatos: ReadonlyArray<Candidato>;
  puedeReasignar: boolean;
}

export function AsignarPrestadorForm({
  ordenId,
  estatus,
  prestadorActualId,
  candidatos,
  puedeReasignar,
}: Props) {
  const router = useRouter();
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [pending, startTransition] = useTransition();

  const esReasignacion = estatus !== 'solicitada' && prestadorActualId !== null;

  function handleSubmit() {
    if (!seleccionado) {
      toast.error('Selecciona un prestador');
      return;
    }
    if (esReasignacion && motivo.trim().length < 5) {
      toast.error('El motivo necesita al menos 5 caracteres');
      return;
    }

    startTransition(async () => {
      const r = esReasignacion
        ? await reasignarOrden(ordenId, seleccionado, motivo)
        : await asignarOrden(ordenId, seleccionado);
      if (r.ok) {
        toast.success(esReasignacion ? 'Orden reasignada' : 'Orden asignada');
        setSeleccionado(null);
        setMotivo('');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos guardar');
      }
    });
  }

  if (estatus === 'completada' || estatus === 'cancelada') {
    return (
      <p className="text-xs text-muted-foreground">
        La orden ya está {estatus}. Sin acciones de asignación.
      </p>
    );
  }

  if (esReasignacion && !puedeReasignar) {
    return (
      <p className="text-xs text-muted-foreground">
        Tu rol no puede reasignar órdenes. Solicita a un gerente que lo haga.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {esReasignacion
          ? 'Selecciona el nuevo prestador y captura el motivo del cambio.'
          : 'Elige el prestador que tomará esta orden.'}
      </p>

      <ul className="space-y-1.5">
        {candidatos.map((c) => {
          const seleccionar = seleccionado === c.id;
          const yaAsignado = c.id === prestadorActualId;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setSeleccionado(c.id)}
                disabled={yaAsignado}
                className={cn(
                  'flex w-full flex-col gap-1 rounded-md border bg-background p-2.5 text-left text-xs transition-colors',
                  seleccionar
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/40',
                  yaAsignado && 'opacity-60 cursor-not-allowed',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{c.nombre}</p>
                    <p className="text-[11px] text-muted-foreground">{c.email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {c.ofrece_servicio ? (
                      <Badge variant="success">Ofrece</Badge>
                    ) : (
                      <Badge variant="warning">Sin servicio</Badge>
                    )}
                    {yaAsignado ? <Badge variant="muted">Actual</Badge> : null}
                    {seleccionar ? (
                      <CheckCircle size={14} weight="fill" className="text-primary" aria-hidden />
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  {c.rating ? (
                    <span className="inline-flex items-center gap-0.5">
                      <Star size={10} weight="fill" aria-hidden /> {c.rating}
                    </span>
                  ) : (
                    <span>Sin calificaciones</span>
                  )}
                  <span>{c.ordenes_completadas} órdenes</span>
                  {c.distancia_km ? <span>{c.distancia_km} km</span> : null}
                </div>
              </button>
            </li>
          );
        })}
        {candidatos.length === 0 ? (
          <li className="px-2 py-3 text-xs text-muted-foreground">
            Sin prestadores activos cerca. Considera ampliar zona de cobertura.
          </li>
        ) : null}
      </ul>

      {esReasignacion ? (
        <div className="space-y-1.5">
          <label className="text-xs font-medium">Motivo de la reasignación</label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            maxLength={280}
            placeholder="Por qué cambias al prestador. Queda en auditoría y notas."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={pending || !seleccionado}
        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        <UserPlus size={14} aria-hidden />
        {pending
          ? 'Guardando…'
          : esReasignacion
            ? 'Reasignar prestador'
            : 'Asignar prestador'}
      </button>
    </div>
  );
}
