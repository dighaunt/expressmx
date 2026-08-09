'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarBlank, FloppyDisk, Plus, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { actualizarTurnosPrestador } from '@/lib/dashboard/actions/prestadores';
import type { PrestadorTurnoRow } from '@/lib/dashboard/queries/prestadores';
import type { ZonaRow } from '@/lib/dashboard/queries/zonas';

type Dia = 'lun' | 'mar' | 'mie' | 'jue' | 'vie' | 'sab' | 'dom';

interface TurnoFormRow {
  localId: string;
  dia: Dia;
  horaInicio: string;
  horaFin: string;
  zonaId: string;
}

interface Props {
  prestadorId: string;
  turnos: ReadonlyArray<PrestadorTurnoRow>;
  zonas: ReadonlyArray<ZonaRow>;
  canEdit: boolean;
}

const DAY_LABEL: Record<Dia, string> = {
  lun: 'Lunes',
  mar: 'Martes',
  mie: 'Miércoles',
  jue: 'Jueves',
  vie: 'Viernes',
  sab: 'Sábado',
  dom: 'Domingo',
};

const DAY_OPTIONS: Dia[] = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];

export function PrestadorTurnosForm({ prestadorId, turnos, zonas, canEdit }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState<TurnoFormRow[]>(() =>
    turnos.map((turno) => ({
      localId: turno.id,
      dia: turno.dia,
      horaInicio: turno.hora_inicio,
      horaFin: turno.hora_fin,
      zonaId: turno.zona_id ?? '',
    })),
  );
  const zonasActivas = useMemo(() => zonas.filter((zona) => zona.estatus === 'activa'), [zonas]);

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        localId: crypto.randomUUID(),
        dia: 'lun',
        horaInicio: '08:00',
        horaFin: '18:00',
        zonaId: '',
      },
    ]);
  }

  function updateRow(localId: string, patch: Partial<TurnoFormRow>) {
    setRows((prev) => prev.map((row) => (row.localId === localId ? { ...row, ...patch } : row)));
  }

  function removeRow(localId: string) {
    setRows((prev) => prev.filter((row) => row.localId !== localId));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;

    startTransition(async () => {
      const result = await actualizarTurnosPrestador(
        prestadorId,
        rows.map((row) => ({
          dia: row.dia,
          horaInicio: row.horaInicio,
          horaFin: row.horaFin,
          zonaId: row.zonaId || null,
        })),
      );
      if (result.ok) {
        toast.success('Turnos actualizados');
        router.refresh();
      } else {
        toast.error(result.message ?? 'No pudimos guardar los turnos');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Turnos operativos
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Horarios administrados por RRHH u Operaciones. La app del prestador solo los consulta.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          <CalendarBlank size={14} aria-hidden />
          {rows.length} turnos
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          Sin turnos asignados. El prestador aparecerá fuera de turno y no recibirá órdenes.
        </div>
      ) : (
        <fieldset disabled={!canEdit || pending} className="space-y-3 disabled:opacity-70">
          {rows.map((row) => (
            <div
              key={row.localId}
              className="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-[1fr_1fr_1fr_1.5fr_auto]"
            >
              <label className="space-y-1 text-xs font-medium text-muted-foreground">
                Día
                <select
                  value={row.dia}
                  onChange={(event) => updateRow(row.localId, { dia: event.target.value as Dia })}
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                >
                  {DAY_OPTIONS.map((dia) => (
                    <option key={dia} value={dia}>
                      {DAY_LABEL[dia]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs font-medium text-muted-foreground">
                Entrada
                <input
                  value={row.horaInicio}
                  onChange={(event) => updateRow(row.localId, { horaInicio: event.target.value })}
                  type="time"
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-muted-foreground">
                Salida
                <input
                  value={row.horaFin}
                  onChange={(event) => updateRow(row.localId, { horaFin: event.target.value })}
                  type="time"
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-muted-foreground">
                Zona
                <select
                  value={row.zonaId}
                  onChange={(event) => updateRow(row.localId, { zonaId: event.target.value })}
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                >
                  <option value="">Todas las zonas</option>
                  {zonasActivas.map((zona) => (
                    <option key={zona.id} value={zona.id}>
                      {zona.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => removeRow(row.localId)}
                  className="inline-flex h-9 w-full items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-muted hover:text-destructive md:w-9"
                  aria-label="Quitar turno"
                >
                  <Trash size={16} aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </fieldset>
      )}

      {canEdit ? (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={addRow}
            disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted disabled:opacity-60"
          >
            <Plus size={16} aria-hidden />
            Agregar turno
          </button>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            <FloppyDisk size={16} aria-hidden />
            {pending ? 'Guardando...' : 'Guardar turnos'}
          </button>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Tu rol no permite cambiar turnos del prestador.
        </p>
      )}
    </form>
  );
}
