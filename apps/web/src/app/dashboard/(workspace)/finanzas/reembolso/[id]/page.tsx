import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowSquareOut, ShieldCheck, Warning } from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { FinanzasQueue } from '@/components/dashboard/finanzas-queue';
import { ReembolsoActions } from '@/components/dashboard/reembolso-actions';
import { ReembolsoStripeButton } from '@/components/dashboard/reembolso-stripe-button';
import {
  ContextSidebar,
  ItemForm,
  WorkspaceBreadcrumbs,
  WorkspaceShell,
} from '@/components/workspace';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';
import { formatFechaLarga, formatMoneda } from '@/lib/dashboard/format';
import {
  ESTATUS_REEMBOLSO_LABEL,
  getReembolso,
  type EstatusReembolso,
} from '@/lib/dashboard/queries/reembolsos';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Reembolso · Finanzas · ExpressMX' };

const ESTATUS_VARIANT: Record<EstatusReembolso, 'success' | 'warning' | 'destructive' | 'info'> = {
  procesado: 'success',
  solicitado: 'warning',
  rechazado: 'destructive',
  aprobado: 'info',
};

export default async function ReembolsoWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requirePermiso('finanzas.ver');
  const { id } = await params;
  const reembolso = await getReembolso(id);
  if (!reembolso) notFound();

  const puedeAprobar = tienePermiso(viewer, 'reembolsos.aprobar');
  const puedeEjecutarStripe =
    puedeAprobar &&
    reembolso.estatus === 'aprobado' &&
    !reembolso.referencia_pasarela &&
    Boolean(reembolso.payment_intent_id);
  const aprobadorMatchea = reembolso.aprobado_por === viewer.userId;
  const viewerNombre = `${viewer.nombre} ${viewer.apellidos}`.trim();

  return (
    <WorkspaceShell
      accent="finanzas"
      header={
        <div className="min-w-0">
          <WorkspaceBreadcrumbs
            items={[
              { label: 'Finanzas', href: '/dashboard/finanzas' },
              { label: 'Reembolsos', href: '/dashboard/finanzas' },
              { label: `Reembolso #${reembolso.id.slice(0, 8)}` },
            ]}
          />
          <h1 className="mt-1 text-base font-semibold truncate">
            {formatMoneda(reembolso.monto, true)}
          </h1>
        </div>
      }
      queue={
        <FinanzasQueue
          viewerId={viewer.userId}
          active={{ kind: 'reembolso', id: reembolso.id }}
          bucket={
            reembolso.estatus === 'solicitado'
              ? 'reembolsos_pendientes'
              : reembolso.estatus === 'aprobado'
                ? 'reembolsos_por_procesar'
                : 'mias'
          }
        />
      }
      main={
        <ItemForm
          title={`Reembolso por ${formatMoneda(reembolso.monto, true)}`}
          subtitle={`Cliente: ${reembolso.cliente_nombre} · servicio ${reembolso.servicio_nombre}`}
          badges={
            <Badge variant={ESTATUS_VARIANT[reembolso.estatus]}>
              {ESTATUS_REEMBOLSO_LABEL[reembolso.estatus]}
            </Badge>
          }
          meta={
            <span>
              Solicitado {formatFechaLarga(reembolso.created_at)}
              {reembolso.aprobado_por_nombre
                ? ` · aprobador previo: ${reembolso.aprobado_por_nombre}`
                : ''}
            </span>
          }
          fields={
            <div className="space-y-4 text-sm">
              <Section title="Motivo del reembolso">
                <p className="whitespace-pre-wrap text-sm">{reembolso.motivo}</p>
              </Section>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Pago original">
                  <span className="tabular-nums">
                    {formatMoneda(reembolso.monto_pago, true)}
                  </span>
                </Field>
                <Field label="Monto a reembolsar">
                  <span className="font-semibold tabular-nums">
                    {formatMoneda(reembolso.monto, true)}
                  </span>
                </Field>
                <Field label="Orden">
                  <Link
                    href={`/dashboard/ordenes/${reembolso.orden_id}`}
                    className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
                  >
                    {reembolso.orden_id.slice(0, 8)}
                    <ArrowSquareOut size={10} aria-hidden />
                  </Link>
                </Field>
                {reembolso.referencia_pasarela ? (
                  <Field label="Referencia pasarela">
                    <span className="font-mono text-xs">{reembolso.referencia_pasarela}</span>
                  </Field>
                ) : null}
              </div>
            </div>
          }
          activity={
            puedeAprobar ? (
              <div className="space-y-3">
                {puedeEjecutarStripe ? (
                  <div className="rounded-lg border border-border bg-card p-4">
                    <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <ShieldCheck size={12} aria-hidden /> Ejecución en pasarela
                    </h3>
                    <ReembolsoStripeButton
                      reembolsoId={reembolso.id}
                      aprobadorMatchea={aprobadorMatchea}
                      aprobadorNombre={reembolso.aprobado_por_nombre}
                      viewerNombre={viewerNombre}
                    />
                  </div>
                ) : null}
                <div className="rounded-lg border border-border bg-card p-4">
                  <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <ShieldCheck size={12} aria-hidden /> Acciones disponibles
                  </h3>
                  <ReembolsoActions reembolsoId={reembolso.id} estatus={reembolso.estatus} />
                  {reembolso.estatus === 'aprobado' && reembolso.aprobado_por_nombre ? (
                    <p className="mt-3 flex items-start gap-1.5 rounded-md border border-warning/40 bg-warning/5 p-2 text-[11px] text-warning-foreground">
                      <Warning size={12} aria-hidden className="mt-0.5 shrink-0" />
                      Segregación de funciones: si tú fuiste quien aprobó, otro miembro del
                      equipo financiero debe ejecutar la acción.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null
          }
        />
      }
      context={
        <ContextSidebar
          sections={[
            {
              key: 'cliente',
              title: 'Cliente',
              children: (
                <div>
                  <p className="font-medium text-sm">{reembolso.cliente_nombre}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Servicio: {reembolso.servicio_nombre}
                  </p>
                </div>
              ),
            },
            {
              key: 'pago',
              title: 'Pago original',
              children: (
                <div>
                  <p className="text-sm tabular-nums">
                    {formatMoneda(reembolso.monto_pago, true)}
                  </p>
                  <Link
                    href={`/dashboard/pagos/${reembolso.pago_id}`}
                    className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Ver pago <ArrowSquareOut size={10} aria-hidden />
                  </Link>
                </div>
              ),
            },
            ...(reembolso.ticket_id
              ? [
                  {
                    key: 'ticket',
                    title: 'Ticket asociado',
                    children: (
                      <Link
                        href={`/dashboard/soporte/ticket/${reembolso.ticket_id}`}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Ver ticket <ArrowSquareOut size={10} aria-hidden />
                      </Link>
                    ),
                  },
                ]
              : []),
          ]}
        />
      }
    />
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div>{children}</div>
    </div>
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
