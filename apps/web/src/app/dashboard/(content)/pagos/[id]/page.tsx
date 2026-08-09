import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowSquareOut } from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/dashboard/page-header';
import { WorkspaceBreadcrumbs } from '@/components/workspace';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import {
  ESTATUS_PAGO_LABEL,
  METODO_PAGO_LABEL,
  type EstatusPago,
} from '@/lib/dashboard/finanzas-shared';
import { formatFechaHora, formatMoneda } from '@/lib/dashboard/format';
import { getPago } from '@/lib/dashboard/queries/pagos';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Pago · ExpressMX' };

const ESTATUS_VARIANT: Record<EstatusPago, 'success' | 'warning' | 'destructive' | 'muted'> = {
  procesado: 'success',
  pendiente: 'warning',
  fallido: 'destructive',
  reembolsado: 'muted',
};

export default async function PagoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermiso('finanzas.ver');
  const { id } = await params;
  const pago = await getPago(id);
  if (!pago) notFound();

  return (
    <>
      <WorkspaceBreadcrumbs
        className="mb-3"
        items={[
          { label: 'Pagos', href: '/dashboard/pagos' },
          { label: `Pago #${pago.id.slice(0, 8)}` },
        ]}
      />

      <PageHeader
        title={formatMoneda(pago.monto, true)}
        description={`Pago ${pago.id.slice(0, 8)} · ${formatFechaHora(pago.created_at)}`}
        actions={<Badge variant={ESTATUS_VARIANT[pago.estatus]}>{ESTATUS_PAGO_LABEL[pago.estatus]}</Badge>}
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Detalle del pago
          </h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Método">{METODO_PAGO_LABEL[pago.metodo]}</Field>
            <Field label="Referencia">
              {pago.referencia_pasarela ? (
                <span className="font-mono text-xs">{pago.referencia_pasarela}</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Field>
            <Field label="Cliente">{pago.cliente_nombre ?? '—'}</Field>
            <Field label="Email cliente">
              {pago.cliente_email ? (
                <span className="text-sm">{pago.cliente_email}</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Field>
            <Field label="Prestador">{pago.prestador_nombre ?? '—'}</Field>
            <Field label="Servicio">{pago.servicio_nombre ?? '—'}</Field>
          </dl>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Orden
            </h2>
            <p className="text-sm">
              <span className="text-muted-foreground">ID</span>{' '}
              <span className="font-mono text-xs">{pago.orden_id.slice(0, 8)}</span>
            </p>
            {pago.orden_estatus ? (
              <p className="mt-1 text-sm">
                <span className="text-muted-foreground">Estatus</span> {pago.orden_estatus}
              </p>
            ) : null}
            {pago.orden_total ? (
              <p className="mt-1 text-sm">
                <span className="text-muted-foreground">Total</span>{' '}
                <span className="font-semibold tabular-nums">
                  {formatMoneda(pago.orden_total, true)}
                </span>
              </p>
            ) : null}
            <Link
              href={`/dashboard/ordenes/${pago.orden_id}`}
              className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Ver en órdenes <ArrowSquareOut size={12} aria-hidden />
            </Link>
          </div>

          {pago.reembolso_id ? (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-warning-foreground">
                Reembolso asociado
              </h2>
              <p className="text-sm">
                <span className="text-muted-foreground">Estatus</span> {pago.reembolso_estatus}
              </p>
              {pago.reembolso_monto ? (
                <p className="mt-1 text-sm">
                  <span className="text-muted-foreground">Monto</span>{' '}
                  <span className="font-semibold tabular-nums">
                    {formatMoneda(pago.reembolso_monto, true)}
                  </span>
                </p>
              ) : null}
              <Link
                href={`/dashboard/reembolsos/${pago.reembolso_id}`}
                className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Ver reembolso <ArrowSquareOut size={12} aria-hidden />
              </Link>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}
