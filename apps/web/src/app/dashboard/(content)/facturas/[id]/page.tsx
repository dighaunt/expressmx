import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowSquareOut,
  FilePdf,
  FileCode,
} from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/dashboard/page-header';
import { WorkspaceBreadcrumbs } from '@/components/workspace';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import {
  ESTATUS_FACTURA_LABEL,
  type EstatusFactura,
} from '@/lib/dashboard/finanzas-shared';
import { formatFechaHora, formatMoneda } from '@/lib/dashboard/format';
import { getFactura } from '@/lib/dashboard/queries/facturas';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Factura · ExpressMX' };

const ESTATUS_VARIANT: Record<EstatusFactura, 'success' | 'destructive'> = {
  timbrada: 'success',
  cancelada: 'destructive',
};

export default async function FacturaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermiso('facturas.ver');
  const { id } = await params;
  const factura = await getFactura(id);
  if (!factura) notFound();

  return (
    <>
      <WorkspaceBreadcrumbs
        className="mb-3"
        items={[
          { label: 'Facturas', href: '/dashboard/facturas' },
          { label: `Factura #${factura.id.slice(0, 8)}` },
        ]}
      />

      <PageHeader
        title={formatMoneda(factura.total, true)}
        description={`CFDI emitido el ${formatFechaHora(factura.created_at)}`}
        actions={
          <Badge variant={ESTATUS_VARIANT[factura.estatus]}>
            {ESTATUS_FACTURA_LABEL[factura.estatus]}
          </Badge>
        }
      />

      <section className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Datos fiscales
          </h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="RFC emisor">
              <span className="font-mono text-sm">{factura.rfc_emisor}</span>
            </Field>
            <Field label="RFC receptor">
              <span className="font-mono text-sm">{factura.rfc_receptor}</span>
            </Field>
            <Field label="UUID CFDI">
              {factura.uuid_cfdi ? (
                <span className="break-all font-mono text-xs">{factura.uuid_cfdi}</span>
              ) : (
                <span className="text-muted-foreground">No disponible</span>
              )}
            </Field>
            <Field label="Subtotal">
              <span className="tabular-nums">{formatMoneda(factura.subtotal, true)}</span>
            </Field>
            <Field label="IVA">
              <span className="tabular-nums">{formatMoneda(factura.iva, true)}</span>
            </Field>
            <Field label="Total">
              <span className="text-lg font-semibold tabular-nums">
                {formatMoneda(factura.total, true)}
              </span>
            </Field>
          </dl>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Origen
            </h2>
            {factura.orden_id ? (
              <Link
                href={`/dashboard/ordenes/${factura.orden_id}`}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Ver orden{' '}
                <span className="font-mono text-xs text-muted-foreground">
                  {factura.orden_id.slice(0, 8)}
                </span>
                <ArrowSquareOut size={12} aria-hidden />
              </Link>
            ) : factura.corte_id ? (
              <Link
                href={`/dashboard/cortes/${factura.corte_id}`}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Ver corte{' '}
                <span className="font-mono text-xs text-muted-foreground">
                  {factura.corte_id.slice(0, 8)}
                </span>
                <ArrowSquareOut size={12} aria-hidden />
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">Sin origen vinculado</p>
            )}
          </div>

          <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Archivos
            </h2>
            <div className="space-y-2">
              <FileLink href={factura.pdf_url} icon="pdf">
                Descargar PDF
              </FileLink>
              <FileLink href={factura.xml_url} icon="xml">
                Descargar XML
              </FileLink>
            </div>
          </div>
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

function FileLink({
  href,
  icon,
  children,
}: {
  href: string | null;
  icon: 'pdf' | 'xml';
  children: React.ReactNode;
}) {
  const Icon = icon === 'pdf' ? FilePdf : FileCode;
  if (!href) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
        <Icon size={16} aria-hidden />
        {children}
        <span className="ml-auto text-xs">No disponible</span>
      </div>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
    >
      <Icon size={16} aria-hidden />
      {children}
      <ArrowSquareOut size={12} aria-hidden className="ml-auto text-muted-foreground" />
    </a>
  );
}
