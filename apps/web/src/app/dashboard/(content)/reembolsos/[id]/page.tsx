import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/dashboard/page-header';
import { ReembolsoActions } from '@/components/dashboard/reembolso-actions';
import { WorkspaceBreadcrumbs } from '@/components/workspace';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { formatFechaLarga, formatMoneda } from '@/lib/dashboard/format';
import {
  ESTATUS_REEMBOLSO_LABEL,
  getReembolso,
  type EstatusReembolso,
} from '@/lib/dashboard/queries/reembolsos';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Reembolso · ExpressMX' };

const VARIANT: Record<EstatusReembolso, 'warning' | 'info' | 'success' | 'destructive'> = {
  solicitado: 'warning',
  aprobado: 'info',
  procesado: 'success',
  rechazado: 'destructive',
};

export default async function ReembolsoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermiso('reembolsos.aprobar');
  const { id } = await params;
  const r = await getReembolso(id);
  if (!r) notFound();

  return (
    <>
      <WorkspaceBreadcrumbs
        className="mb-3"
        items={[
          { label: 'Reembolsos', href: '/dashboard/reembolsos' },
          { label: `Reembolso #${r.id.slice(0, 8).toUpperCase()}` },
        ]}
      />

      <PageHeader
        title={`Reembolso de ${r.cliente_nombre}`}
        description={`#${r.id.slice(0, 8).toUpperCase()} · solicitado el ${formatFechaLarga(r.created_at)}`}
        actions={<Badge variant={VARIANT[r.estatus]}>{ESTATUS_REEMBOLSO_LABEL[r.estatus]}</Badge>}
      />

      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Monto solicitado" value={formatMoneda(r.monto)} accent="primary" />
        <Stat label="Total del pago" value={formatMoneda(r.monto_pago)} />
        <Stat label="Servicio" value={r.servicio_nombre} />
      </section>

      <section className="mb-6 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Motivo
        </h2>
        <p className="whitespace-pre-wrap text-sm">{r.motivo}</p>
        {r.aprobado_por_nombre ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Resuelto por {r.aprobado_por_nombre}
          </p>
        ) : null}
        {r.referencia_pasarela ? (
          <p className="mt-1 text-xs text-muted-foreground font-mono">
            Pasarela: {r.referencia_pasarela}
          </p>
        ) : null}
      </section>

      <section className="mb-6 flex flex-wrap gap-2">
        <Link
          href={`/dashboard/ordenes/${r.orden_id}`}
          className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted"
        >
          Ver orden
        </Link>
        {r.ticket_id ? (
          <Link
            href={`/dashboard/tickets/${r.ticket_id}`}
            className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted"
          >
            Ver ticket relacionado
          </Link>
        ) : null}
      </section>

      <ReembolsoActions reembolsoId={r.id} estatus={r.estatus} />
    </>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'primary';
}) {
  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-xl font-semibold tabular-nums tracking-tight ${
          accent === 'primary' ? 'text-primary' : ''
        }`}
      >
        {value}
      </p>
    </div>
  );
}
