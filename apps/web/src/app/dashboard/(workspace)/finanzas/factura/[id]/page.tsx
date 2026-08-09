import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowSquareOut, FileCode, FilePdf } from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { FinanzasQueue } from '@/components/dashboard/finanzas-queue';
import {
  ContextSidebar,
  ItemForm,
  WorkspaceBreadcrumbs,
  WorkspaceShell,
} from '@/components/workspace';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import {
  ESTATUS_FACTURA_LABEL,
  type EstatusFactura,
} from '@/lib/dashboard/finanzas-shared';
import { formatFechaHora, formatMoneda } from '@/lib/dashboard/format';
import { getFactura } from '@/lib/dashboard/queries/facturas';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Factura · Finanzas · ExpressMX' };

const ESTATUS_VARIANT: Record<EstatusFactura, 'success' | 'destructive'> = {
  timbrada: 'success',
  cancelada: 'destructive',
};

export default async function FacturaWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requirePermiso('facturas.ver');
  const { id } = await params;
  const factura = await getFactura(id);
  if (!factura) notFound();

  return (
    <WorkspaceShell
      accent="finanzas"
      header={
        <div className="min-w-0">
          <WorkspaceBreadcrumbs
            items={[
              { label: 'Finanzas', href: '/dashboard/finanzas' },
              {
                label: 'Facturas',
                href: '/dashboard/finanzas?bucket=facturas',
              },
              { label: `Factura #${factura.id.slice(0, 8)}` },
            ]}
          />
          <h1 className="mt-1 text-base font-semibold truncate">
            {formatMoneda(factura.total, true)}
          </h1>
        </div>
      }
      queue={
        <FinanzasQueue
          viewerId={viewer.userId}
          active={{ kind: 'factura', id: factura.id }}
          bucket="facturas"
        />
      }
      main={
        <ItemForm
          title={`Factura por ${formatMoneda(factura.total, true)}`}
          subtitle={`Receptor ${factura.rfc_receptor} · ${formatFechaHora(factura.created_at)}`}
          badges={
            <Badge variant={ESTATUS_VARIANT[factura.estatus]}>
              {ESTATUS_FACTURA_LABEL[factura.estatus]}
            </Badge>
          }
          fields={
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="RFC emisor">
                  <span className="font-mono text-xs">{factura.rfc_emisor}</span>
                </Field>
                <Field label="RFC receptor">
                  <span className="font-mono text-xs">{factura.rfc_receptor}</span>
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
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Archivos
                </h3>
                <FileLink href={factura.pdf_url} icon="pdf">
                  Descargar PDF
                </FileLink>
                <FileLink href={factura.xml_url} icon="xml">
                  Descargar XML
                </FileLink>
              </div>
            </div>
          }
        />
      }
      context={
        <ContextSidebar
          sections={[
            {
              key: 'origen',
              title: 'Origen',
              children: factura.orden_id ? (
                <Link
                  href={`/dashboard/ordenes/${factura.orden_id}`}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Ver orden{' '}
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {factura.orden_id.slice(0, 8)}
                  </span>
                  <ArrowSquareOut size={10} aria-hidden />
                </Link>
              ) : factura.corte_id ? (
                <Link
                  href={`/dashboard/finanzas/corte/${factura.corte_id}`}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Ver corte vinculado{' '}
                  <ArrowSquareOut size={10} aria-hidden />
                </Link>
              ) : (
                <p className="text-xs text-muted-foreground">Sin origen vinculado.</p>
              ),
            },
            {
              key: 'nota',
              title: 'Nota',
              children: (
                <p className="text-xs text-muted-foreground">
                  Las facturas se emiten desde el sistema externo CFDI. El panel solo
                  muestra el registro y los archivos PDF/XML una vez timbrada.
                </p>
              ),
            },
          ]}
        />
      }
    />
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
