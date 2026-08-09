'use client';

import { useTransition } from 'react';
import {
  CheckCircle,
  ClipboardText,
  Clock,
  FileText,
  IdentificationCard,
  WarningCircle,
  XCircle,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import type { DocumentoRow } from '@/lib/dashboard/queries/prestadores';

type ActionResult = { ok: boolean; message?: string };

interface Props {
  doc: DocumentoRow;
  canReview: boolean;
  aprobar: (id: string) => Promise<ActionResult>;
  rechazar: (id: string, motivo: string) => Promise<ActionResult>;
}

const ICON_BY_TIPO: Record<DocumentoRow['tipo'], React.ReactNode> = {
  ine: <IdentificationCard size={20} aria-hidden />,
  curp: <FileText size={20} aria-hidden />,
  domicilio: <ClipboardText size={20} aria-hidden />,
  certificacion: <FileText size={20} aria-hidden />,
};

const LABEL_TIPO: Record<DocumentoRow['tipo'], string> = {
  ine: 'Identificación oficial (INE)',
  curp: 'CURP',
  domicilio: 'Comprobante de domicilio',
  certificacion: 'Certificación profesional',
};

export function DocumentRow({ doc, canReview, aprobar, rechazar }: Props) {
  const [pending, startTransition] = useTransition();

  function handleAprobar() {
    startTransition(async () => {
      const r = await aprobar(doc.id);
      if (r.ok) {
        toast.success('Documento aprobado');
      } else {
        toast.error(r.message ?? 'No pudimos aprobar el documento');
      }
    });
  }

  function handleRechazar() {
    const motivo = window.prompt('Motivo del rechazo (será visible para el prestador):');
    if (!motivo) return;
    if (motivo.trim().length < 5) {
      toast.error('El motivo necesita al menos 5 caracteres');
      return;
    }
    startTransition(async () => {
      const r = await rechazar(doc.id, motivo.trim());
      if (r.ok) {
        toast.success('Documento rechazado');
      } else {
        toast.error(r.message ?? 'No pudimos rechazar el documento');
      }
    });
  }

  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      <span className="inline-flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {ICON_BY_TIPO[doc.tipo]}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{LABEL_TIPO[doc.tipo]}</p>
        <p className="text-xs text-muted-foreground">
          Subido el{' '}
          {new Date(doc.created_at).toLocaleDateString('es-MX', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
          {doc.fecha_expiracion ? (
            <> · Vence {new Date(doc.fecha_expiracion).toLocaleDateString('es-MX')}</>
          ) : null}
        </p>
      </div>
      <a
        href={doc.archivo_url}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted"
      >
        Ver
      </a>
      {doc.estatus === 'aprobado' ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
          <CheckCircle size={14} weight="fill" aria-hidden />
          Aprobado
        </span>
      ) : doc.estatus === 'rechazado' ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
          <WarningCircle size={14} weight="fill" aria-hidden />
          Rechazado
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-warning-foreground">
          <Clock size={14} weight="fill" aria-hidden />
          Pendiente
        </span>
      )}

      {canReview && doc.estatus === 'pendiente' ? (
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={handleAprobar}
            disabled={pending}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-success/40 bg-success/10 px-2 text-xs font-medium text-success transition-colors hover:bg-success/20 disabled:opacity-60"
          >
            <CheckCircle size={14} aria-hidden />
            Aprobar
          </button>
          <button
            type="button"
            onClick={handleRechazar}
            disabled={pending}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-60"
          >
            <XCircle size={14} aria-hidden />
            Rechazar
          </button>
        </div>
      ) : null}
    </li>
  );
}
