import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowSquareOut } from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { CorteControls } from '@/components/dashboard/corte-controls';
import { PageHeader } from '@/components/dashboard/page-header';
import { WorkspaceBreadcrumbs } from '@/components/workspace';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { decryptClabe, mascaraClabe } from '@/lib/banking/clabe';
import { tienePermiso } from '@/lib/dashboard/rbac';
import {
  ESTATUS_CORTE_LABEL,
  type EstatusCorte,
} from '@/lib/dashboard/finanzas-shared';
import { formatFechaHora, formatFechaLarga, formatMoneda, formatNumero } from '@/lib/dashboard/format';
import { getCorte, listarTransaccionesDelCorte } from '@/lib/dashboard/queries/cortes';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Corte · ExpressMX' };

const ESTATUS_VARIANT: Record<EstatusCorte, 'info' | 'warning' | 'success'> = {
  generado: 'warning',
  revisado: 'info',
  depositado: 'success',
};

export default async function CorteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requirePermiso('finanzas.ver');
  const { id } = await params;
  const corte = await getCorte(id);
  if (!corte) notFound();

  const puedeAprobar = tienePermiso(viewer, 'cortes.generar');
  const clabeCompleta =
    puedeAprobar && corte.cuenta_bancaria_clabe_ciphertext
      ? tryDecryptClabe(corte.cuenta_bancaria_clabe_ciphertext)
      : null;
  const clabeMascara = mascaraClabe(corte.cuenta_bancaria_clabe_ultimos4);
  const transacciones = await listarTransaccionesDelCorte(corte.prestador_id, corte.fecha_corte);
  const totalConfirmado = transacciones
    .filter((t) => t.estatus_deposito === 'depositado')
    .reduce((acc, t) => acc + Number(t.monto_prestador), 0);

  return (
    <>
      <WorkspaceBreadcrumbs
        className="mb-3"
        items={[
          { label: 'Cortes', href: '/dashboard/cortes' },
          { label: `Corte #${corte.id.slice(0, 8)}` },
        ]}
      />

      <PageHeader
        title={`Corte ${formatFechaLarga(corte.fecha_corte)}`}
        description={`${corte.prestador_nombre} · ${formatFechaHora(corte.created_at)}`}
        actions={<Badge variant={ESTATUS_VARIANT[corte.estatus]}>{ESTATUS_CORTE_LABEL[corte.estatus]}</Badge>}
      />

      <section className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Resumen
          </h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Prestador">
              <span className="font-medium">{corte.prestador_nombre}</span>
              <div className="text-xs text-muted-foreground">{corte.prestador_email}</div>
            </Field>
            <Field label="Transacciones">{formatNumero(corte.num_transacciones)}</Field>
            <Field label="Monto total">
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
            {corte.aprobado_por_nombre ? (
              <Field label="Aprobado por">
                <span>{corte.aprobado_por_nombre}</span>
              </Field>
            ) : null}
            <Field label="Cuenta del prestador">
              {corte.cuenta_bancaria_banco ? (
                <span>
                  <span className="font-medium">{corte.cuenta_bancaria_banco}</span>
                  <span className="block font-mono text-xs text-muted-foreground">
                    {clabeCompleta ?? clabeMascara}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {corte.cuenta_bancaria_titular} · {corte.cuenta_bancaria_estatus}
                  </span>
                </span>
              ) : (
                <span className="text-destructive">Sin CLABE capturada</span>
              )}
            </Field>
          </dl>
        </div>

        {puedeAprobar ? (
          <CorteControls
            corteId={corte.id}
            estatus={corte.estatus}
            referenciaInicial={corte.referencia_bancaria ?? ''}
            fechaDepositoInicial={corte.fecha_deposito ?? ''}
          />
        ) : null}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Transacciones del prestador en este ciclo
        </h2>
        {transacciones.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
            Sin transacciones asociadas al rango del corte.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Fecha</th>
                  <th className="px-4 py-2.5 text-left font-medium">Orden</th>
                  <th className="px-4 py-2.5 text-right font-medium">Prestador</th>
                  <th className="hidden px-4 py-2.5 text-right font-medium md:table-cell">
                    Comisión
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium">Depósito</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transacciones.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/30">
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatFechaHora(t.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/ordenes/${t.orden_id}`}
                        className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
                      >
                        {t.orden_id.slice(0, 8)}
                        <ArrowSquareOut size={10} aria-hidden />
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">
                      {formatMoneda(t.monto_prestador, true)}
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-right text-muted-foreground tabular-nums md:table-cell">
                      {formatMoneda(t.comision_plataforma, true)}
                    </td>
                    <td className="px-4 py-3">
                      {t.estatus_deposito === 'depositado' ? (
                        <Badge variant="success">Depositado</Badge>
                      ) : (
                        <Badge variant="warning">Pendiente</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

function tryDecryptClabe(ciphertext: string): string | null {
  try {
    return decryptClabe(ciphertext);
  } catch {
    return null;
  }
}
