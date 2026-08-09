'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Prohibit } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { suspenderCuenta } from '@/lib/dashboard/actions/soporte-suspender';

const MOTIVOS = [
  { value: 'fraude_sospechoso', label: 'Fraude sospechoso' },
  { value: 'incumplimiento_pago', label: 'Incumplimiento de pago' },
  { value: 'abuso_servicio', label: 'Abuso del servicio' },
  { value: 'queja_prestador', label: 'Queja del prestador' },
  { value: 'verificacion_pendiente', label: 'Verificación pendiente' },
  { value: 'a_solicitud_cliente', label: 'A solicitud del cliente' },
] as const;

type Motivo = (typeof MOTIVOS)[number]['value'];

interface Props {
  ticketId: string;
  usuarioId: string;
  maxExpressDias: number;
}

export function ActionSuspendDialog({ ticketId, usuarioId, maxExpressDias }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [motivo, setMotivo] = useState<Motivo>('verificacion_pendiente');
  const [notas, setNotas] = useState('');
  const [dias, setDias] = useState<string>(String(maxExpressDias));
  const [indefinido, setIndefinido] = useState(false);

  const diasNumber = Number(dias);
  const requiereAprobacion =
    indefinido || !Number.isFinite(diasNumber) || diasNumber > maxExpressDias;

  function handleSubmit() {
    if (notas.trim().length < 10) {
      toast.error('Notas mínimo 10 caracteres');
      return;
    }
    if (!indefinido && (!Number.isFinite(diasNumber) || diasNumber < 1)) {
      toast.error('Días inválido (mínimo 1)');
      return;
    }
    startTransition(async () => {
      const r = await suspenderCuenta({
        ticketId,
        usuarioId,
        motivo,
        notas: notas.trim(),
        diasVentana: indefinido ? null : diasNumber,
      });
      if (r.ok) {
        toast.success(
          requiereAprobacion
            ? 'Suspensión solicitada. Esperando aprobación super_admin.'
            : 'Cuenta suspendida.',
        );
        setOpen(false);
        setNotas('');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos suspender');
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-left text-sm font-medium text-destructive hover:bg-destructive/10"
      >
        <Prohibit size={14} aria-hidden />
        <span className="flex-1">Suspender cuenta</span>
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
      <p className="text-xs font-medium text-destructive">Suspender cuenta</p>

      <label className="block space-y-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Motivo
        </span>
        <select
          value={motivo}
          onChange={(e) => setMotivo(e.target.value as Motivo)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        >
          {MOTIVOS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Días de suspensión {indefinido ? '(deshabilitado)' : ''}
        </span>
        <input
          type="number"
          min="1"
          max="365"
          disabled={indefinido}
          value={dias}
          onChange={(e) => setDias(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-50"
        />
      </label>

      <label className="flex items-center gap-2 text-[11px]">
        <input
          type="checkbox"
          checked={indefinido}
          onChange={(e) => setIndefinido(e.target.checked)}
          className="rounded border-border"
        />
        <span>Indefinida (requiere aprobación super_admin)</span>
      </label>

      <label className="block space-y-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Notas (≥10 caracteres)
        </span>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Detalle de la causa, evidencia, ticket relacionado..."
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
      </label>

      <p className="text-[10px] text-muted-foreground">
        {requiereAprobacion
          ? 'Esta suspensión requerirá aprobación de super_admin.'
          : `Suspensión inmediata por ${diasNumber} días, sin aprobación.`}
      </p>

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
          className="rounded-md border border-destructive bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
        >
          {pending ? 'Aplicando...' : requiereAprobacion ? 'Solicitar aprobación' : 'Suspender'}
        </button>
      </div>
    </div>
  );
}
