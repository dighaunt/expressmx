import type { Metadata } from 'next';
import {
  Database,
  MapTrifold,
  Percent,
  ShieldCheck,
  Toolbox,
  UsersThree,
} from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { ComisionForm } from '@/components/dashboard/comision-form';
import { ComisionRowActions } from '@/components/dashboard/comision-row-actions';
import { EmptyState } from '@/components/dashboard/empty-state';
import { MetricCard } from '@/components/dashboard/metric-card';
import { PageHeader } from '@/components/dashboard/page-header';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';
import { formatFechaCorta, formatNumero } from '@/lib/dashboard/format';
import {
  getInfoSistema,
  listarCategoriasParaComision,
  listarComisiones,
} from '@/lib/dashboard/queries/sistema';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Sistema · ExpressMX' };

export default async function SistemaPage() {
  const viewer = await requirePermiso('sistema.ver');
  const puedeGestionarComisiones = tienePermiso(viewer, 'comisiones.gestionar');

  const [info, comisiones, categorias] = await Promise.all([
    getInfoSistema(),
    listarComisiones(),
    listarCategoriasParaComision(),
  ]);

  return (
    <>
      <PageHeader
        title="Sistema"
        description="Configuración global de la plataforma y resumen de inventario"
      />

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={UsersThree}
          label="Usuarios totales"
          value={formatNumero(info.total_usuarios)}
          accent="primary"
          hint={`${formatNumero(info.total_clientes)} clientes · ${formatNumero(
            info.total_prestadores,
          )} prestadores`}
        />
        <MetricCard
          icon={ShieldCheck}
          label="Equipo admin"
          value={formatNumero(info.total_admins)}
          accent="primary"
          hint={`${formatNumero(info.total_roles_admin)} roles · ${formatNumero(
            info.total_permisos,
          )} permisos`}
        />
        <MetricCard
          icon={Toolbox}
          label="Catálogo"
          value={formatNumero(info.total_servicios)}
          accent="neutral"
          hint={`${formatNumero(info.total_categorias)} categorías`}
        />
        <MetricCard
          icon={MapTrifold}
          label="Cobertura"
          value={formatNumero(info.total_zonas)}
          accent="neutral"
          hint={`${formatNumero(info.total_ordenes)} órdenes históricas`}
        />
      </section>

      <section className="mb-6">
        <header className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Comisiones por categoría
            </h2>
            <p className="text-xs text-muted-foreground">
              Define el porcentaje que la plataforma cobra a los prestadores.
              Si especificas un umbral, los prestadores con más órdenes ese mes
              pagan el porcentaje por volumen.
            </p>
          </div>
        </header>

        {comisiones.length === 0 ? (
          <EmptyState
            icon={Percent}
            title="Sin comisiones definidas"
            description="Crea la primera comisión para empezar a calcular pagos a prestadores."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Categoría</th>
                  <th className="px-4 py-2.5 text-right font-medium">% Base</th>
                  <th className="hidden px-4 py-2.5 text-right font-medium md:table-cell">
                    % Volumen
                  </th>
                  <th className="hidden px-4 py-2.5 text-right font-medium md:table-cell">
                    Umbral
                  </th>
                  <th className="hidden px-4 py-2.5 text-left font-medium lg:table-cell">
                    Vigencia
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium">Estado</th>
                  {puedeGestionarComisiones ? <th className="w-10 px-2" /> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {comisiones.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{c.categoria_nombre}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {Number(c.porcentaje_base).toFixed(2)}%
                    </td>
                    <td className="hidden px-4 py-3 text-right tabular-nums md:table-cell">
                      {c.porcentaje_volumen
                        ? `${Number(c.porcentaje_volumen).toFixed(2)}%`
                        : '—'}
                    </td>
                    <td className="hidden px-4 py-3 text-right tabular-nums md:table-cell">
                      {c.umbral_ordenes_mes !== null
                        ? `${formatNumero(c.umbral_ordenes_mes)} órdenes/mes`
                        : '—'}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                      {formatFechaCorta(c.vigencia_inicio)}
                      {' → '}
                      {c.vigencia_fin ? formatFechaCorta(c.vigencia_fin) : 'sin fin'}
                    </td>
                    <td className="px-4 py-3">
                      {c.activa ? (
                        <Badge variant="success">Activa</Badge>
                      ) : (
                        <Badge variant="muted">Pausada</Badge>
                      )}
                    </td>
                    {puedeGestionarComisiones ? (
                      <td className="px-2">
                        <ComisionRowActions comisionId={c.id} />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {puedeGestionarComisiones ? (
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-semibold">Crear nueva comisión</h3>
            <div className="max-w-2xl">
              <ComisionForm mode="create" categorias={categorias} />
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <header className="mb-3 flex items-center gap-2">
          <span className="inline-flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Database size={14} aria-hidden />
          </span>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Información del entorno
          </h2>
        </header>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Field label="Schema de base de datos">
            <span className="font-mono text-xs">00.sql + migrations 001-002</span>
          </Field>
          <Field label="Tablas principales">
            <span>
              {formatNumero(info.total_usuarios)} usuarios ·{' '}
              {formatNumero(info.total_ordenes)} órdenes ·{' '}
              {formatNumero(info.total_servicios)} servicios
            </span>
          </Field>
          <Field label="RBAC">
            <span>
              {formatNumero(info.total_roles_admin)} roles ·{' '}
              {formatNumero(info.total_permisos)} permisos
            </span>
          </Field>
          <Field label="Configuración detallada">
            <span className="text-xs text-muted-foreground">
              Las claves de servicios externos (Resend, JWT, DB) viven en variables de
              entorno y se gestionan fuera del panel.
            </span>
          </Field>
        </dl>
      </section>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
