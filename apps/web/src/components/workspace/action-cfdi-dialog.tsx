'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Receipt } from '@phosphor-icons/react';
import { toast } from 'sonner';
import {
  solicitarCancelacionCfdi,
  solicitarReemisionCfdi,
} from '@/lib/dashboard/actions/soporte-cfdi';
import { formatMoneda } from '@/lib/dashboard/format';

interface FacturaOption {
  id: string;
  uuid_cfdi: string | null;
  estatus: string;
  total: string;
}

interface Props {
  ticketId: string;
  facturas: FacturaOption[];
}

const MOTIVOS_SAT = [
  { value: '01', label: '01 - Comprobante emitido con errores con relación' },
  { value: '02', label: '02 - Comprobante emitido con errores sin relación' },
  { value: '03', label: '03 - No se llevó a cabo la operación' },
  { value: '04', label: '04 - Operación nominativa relacionada en factura global' },
] as const;

type MotivoSat = (typeof MOTIVOS_SAT)[number]['value'];

export function ActionCfdiDialog({ ticketId, facturas }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const timbradas = facturas.filter((f) => f.estatus === 'timbrada');
  const canceladas = facturas.filter((f) => f.estatus === 'cancelada');

  const [accion, setAccion] = useState<'cancelar' | 'reemitir'>('cancelar');
  const [facturaId, setFacturaId] = useState(timbradas[0]?.id ?? canceladas[0]?.id ?? '');
  const [motivoSat, setMotivoSat] = useState<MotivoSat>('02');
  const [notas, setNotas] = useState('');

  if (timbradas.length === 0 && canceladas.length === 0) return null;

  const opcionesAccion: Array<{ value: 'cancelar' | 'reemitir'; label: string; disabled: boolean }> = [
    { value: 'cancelar', label: 'Cancelar CFDI', disabled: timbradas.length === 0 },
    { value: 'reemitir', label: 'Reemitir CFDI', disabled: canceladas.length === 0 },
  ];

  const opcionesFacturas = accion === 'cancelar' ? timbradas : canceladas;

  function handleSubmit() {
    if (!facturaId) {
      toast.error('Selecciona una factura');
      return;
    }
    if (notas.trim().length < 10) {
      toast.error('Notas mínimo 10 caracteres');
      return;
    }
    startTransition(async () => {
      const r =
        accion === 'cancelar'
          ? await solicitarCancelacionCfdi({
              ticketId,
              facturaId,
              motivoSat,
              notas: notas.trim(),
            })
          : await solicitarReemisionCfdi({
              ticketId,
              facturaId,
              notas: notas.trim(),
            });
      if (r.ok) {
        toast.success(
          accion === 'cancelar'
            ? 'Cancelación CFDI enviada a finanzas.'
            : 'Reemisión CFDI enviada a finanzas.',
        );
        setOpen(false);
        setNotas('');
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
        <Receipt size={14} aria-hidden />
        <span className="flex-1">CFDI: cancelar / reemitir</span>
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-border bg-background p-3 text-sm">
      <p className="text-xs font-medium text-foreground">CFDI</p>

      <label className="block space-y-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Acción
        </span>
        <select
          value={accion}
          onChange={(e) => {
            const v = e.target.value as 'cancelar' | 'reemitir';
            setAccion(v);
            const lista = v === 'cancelar' ? timbradas : canceladas;
            setFacturaId(lista[0]?.id ?? '');
          }}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        >
          {opcionesAccion.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label} {o.disabled ? '(sin facturas elegibles)' : ''}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Factura
        </span>
        <select
          value={facturaId}
          onChange={(e) => setFacturaId(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        >
          {opcionesFacturas.map((f) => (
            <option key={f.id} value={f.id}>
              {f.uuid_cfdi ? f.uuid_cfdi.slice(0, 12) + '...' : f.id.slice(0, 8)} · {formatMoneda(f.total, true)}
            </option>
          ))}
        </select>
      </label>

      {accion === 'cancelar' ? (
        <label className="block space-y-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Motivo SAT
          </span>
          <select
            value={motivoSat}
            onChange={(e) => setMotivoSat(e.target.value as MotivoSat)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          >
            {MOTIVOS_SAT.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="block space-y-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Notas (≥10 caracteres)
        </span>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Detalle del error en la factura, datos correctos a usar..."
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
          {pending ? 'Enviando...' : 'Enviar a finanzas'}
        </button>
      </div>
    </div>
  );
}
