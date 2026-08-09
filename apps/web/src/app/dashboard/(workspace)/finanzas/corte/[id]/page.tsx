import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowSquareOut, Bank } from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { CorteControls } from '@/components/dashboard/corte-controls';
import { FinanzasQueue } from '@/components/dashboard/finanzas-queue';
import {
  ContextSidebar,
  ItemForm,
  WorkspaceBreadcrumbs,
  WorkspaceShell,
} from '@/components/workspace';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';
import {
  ESTATUS_CORTE_LABEL,
  type EstatusCorte,
} from '@/lib/dashboard/finanzas-shared';
import {
  formatFechaCorta,
  formatFechaHora,
  formatFechaLarga,
  formatMoneda,
  formatNumero,
} from '@/lib/dashboard/format';
import {
  getCorte,
  listarTransaccionesDelCorte,
} from '@/lib/dashboard/queries/cortes';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Corte · Finanzas · ExpressMX' };

const ESTATUS_VARIANT: Record<EstatusCorte, 'info' | 'warning' | 'success'> = {
  generado: 'warning',
  revisado: 'info',
  depositado: 'success',
};

export default async function CorteWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requirePermiso('finanzas.ver');
  const { id } = await params;
  const corte = await getCorte(id);
  if (!corte) notFound();

  const puedeAprobar = tienePermiso(viewer, 'cortes.generar');
  const transacciones = await listarTransaccionesDelCorte(corte.prestador_id, corte.fecha_corte);
  const totalConfirmado = transacciones
    .filter((t) => t.estatus_deposito === 'depositado')
    .reduce((acc, t) => acc + Number(t.monto_prestador), 0);

  return (
    <WorkspaceShell
      accent="finanzas"
      header={
        <div className="min-w-0">
          <WorkspaceBreadcrumbs
            items={[
              { label: 'Finanzas', href: '/dashboard/finanzas' },
              {
                label: 'Cortes',
                href: '/dashboard/finanzas?bucket=cortes_por_revisar',
              },
              { label: `Corte #${corte.id.slice(0, 8)}` },
            ]}
          />
          <h1 className="mt-1 text-base font-semibold truncate">
            {corte.prestador_nombre} · {formatFechaCorta(corte.fecha_corte)}
          </h1>
        </div>
      }
      queue={
        <FinanzasQueue
          viewerId={viewer.userId}
          active={{ kind: 'corte', id: corte.id }}
          bucket={
            corte.estatus === 'generado' ? 'cortes_por_revisar' : 'cortes_por_depositar'
          }
        />
      }
      main={
        <ItemForm
          title={`Corte de ${formatMoneda(corte.monto_total, true)}`}
          subtitle={`${corte.prestador_nombre} · corte del ${formatFechaLarga(corte.fecha_corte)}`}
          badges={
            <Badge variant={ESTATUS_VARIANT[corte.estatus]}>
              {ESTATUS_CORTE_LABEL[corte.estatus]}
            </Badge>
          }
          meta={
            <span>
              {formatNumero(corte.num_transacciones)} transacciones · creado{' '}
              {formatFechaHora(corte.created_at)}
              {corte.aprobado_por_nombre
                ? ` · aprobado por ${corte.aprobado_por_nombre}`
                : ''}
            </span>
          }
          fields={
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Monto del corte">
                  <span className="text-lg font-semibold tabular-nums">
                    {formatMoneda(corte.monto_total, true)}
                  </span>
                </Field>
                <Field label="Confirmado en transacciones">
                  <span className="tabular-nums">{formatMoneda(totalConfirmado, true)}</span>
                </Field>
                <Field label="Referencia bancaria">
                  {corte.referencia_bancaria ? (
                    <span className="font-mono text-xs">{corte.referencia_bancaria}</span>
                  ) : (
                    <span className="text-muted-foreground">Pendiente</span>
                  )}
                </Field>
                <Field label="Fecha de depósito">
                  {corte.fecha_deposito ? formatFechaLarga(corte.fecha_deposito) : '—'}
                </Field>
              </div>

              <div className="rounded-lg border border-border bg-card p-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Transacciones del periodo ({transacciones.length})
                </h3>
                {transacciones.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin transacciones.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {transacciones.slice(0, 8).map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                        <span className="text-muted-foreground">
                          {formatFechaHora(t.created_at)}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {t.orden_id.slice(0, 8)}
                        </span>
                        <span className="font-semibold tabular-nums">
                          {formatMoneda(t.monto_prestador, true)}
                        </span>
                        <Badge
                          variant={t.estatus_deposito === 'depositado' ? 'success' : 'warning'}
                        >
                          {t.estatus_deposito}
                        </Badge>
                      </li>
                    ))}
                    {transacciones.length > 8 ? (
                      <li className="pt-2 text-[11px] text-muted-foreground">
                        + {transacciones.length - 8} más
                      </li>
                    ) : null}
                  </ul>
                )}
              </div>
            </div>
          }
          activity={
            puedeAprobar ? (
              <CorteControls
                corteId={corte.id}
                estatus={corte.estatus}
                referenciaInicial={corte.referencia_bancaria ?? ''}
                fechaDepositoInicial={corte.fecha_deposito ?? ''}
              />
            ) : null
          }
        />
      }
      context={
        <ContextSidebar
          sections={[
            {
              key: 'prestador',
              title: 'Prestador',
              children: (
                <div>
                  <p className="font-medium text-sm">{corte.prestador_nombre}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {corte.prestador_email}
                  </p>
                </div>
              ),
            },
            {
              key: 'origen',
              title: 'Histórico',
              children: (
                <Link
                  href={`/dashboard/cortes?q=${corte.prestador_id}`}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Bank size={12} aria-hidden /> Ver cortes anteriores{' '}
                  <ArrowSquareOut size={10} aria-hidden />
                </Link>
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
