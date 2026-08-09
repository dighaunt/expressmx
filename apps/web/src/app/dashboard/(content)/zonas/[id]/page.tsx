import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { PageHeader } from '@/components/dashboard/page-header';
import { TarifaForm } from '@/components/dashboard/tarifa-form';
import { TarifaRowActions } from '@/components/dashboard/tarifa-row-actions';
import { ZonaForm } from '@/components/dashboard/zona-form';
import { WorkspaceBreadcrumbs } from '@/components/workspace';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';
import { formatFechaCorta, formatMoneda, formatNumero } from '@/lib/dashboard/format';
import { listarServicios } from '@/lib/dashboard/queries/catalogo';
import {
  ESTATUS_ZONA_LABEL,
  getZona,
  listarTarifasDeZona,
  type EstatusZona,
} from '@/lib/dashboard/queries/zonas';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Zona · ExpressMX' };

const VARIANT_BY_ESTATUS: Record<EstatusZona, 'success' | 'warning' | 'destructive'> = {
  activa: 'success',
  en_expansion: 'warning',
  suspendida: 'destructive',
};

export default async function ZonaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requirePermiso('zonas.ver');
  const { id } = await params;
  const [zona, tarifas, serviciosCatalog] = await Promise.all([
    getZona(id),
    listarTarifasDeZona(id),
    listarServicios({ estado: 'activos', limit: 200 }),
  ]);
  if (!zona) notFound();

  const canManage = tienePermiso(viewer, 'zonas.gestionar');
  const tarifasActivas = tarifas.filter((t) => t.activa).length;

  return (
    <>
      <WorkspaceBreadcrumbs
        className="mb-3"
        items={[
          { label: 'Zonas', href: '/dashboard/zonas' },
          { label: zona.nombre },
        ]}
      />

      <PageHeader
        title={zona.nombre}
        description={`Centro: ${Number(zona.centro_lat).toFixed(4)}, ${Number(zona.centro_lng).toFixed(4)}`}
        actions={
          <Badge variant={VARIANT_BY_ESTATUS[zona.estatus]}>
            {ESTATUS_ZONA_LABEL[zona.estatus]}
          </Badge>
        }
      />

      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat
          label="Radio de cobertura"
          value={zona.radio_km ? `${Number(zona.radio_km).toFixed(1)} km` : '—'}
        />
        <Stat label="Tarifas activas" value={formatNumero(tarifasActivas)} />
        <Stat label="Prestadores en zona" value={formatNumero(zona.prestadores_count)} />
      </section>

      {canManage ? (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Datos de la zona
          </h2>
          <ZonaForm
            mode="edit"
            zonaId={zona.id}
            initial={{
              nombre: zona.nombre,
              centro_lat: Number(zona.centro_lat),
              centro_lng: Number(zona.centro_lng),
              radio_km: zona.radio_km === null ? null : Number(zona.radio_km),
              estatus: zona.estatus,
            }}
          />
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Tarifas
            </h2>
            <p className="text-xs text-muted-foreground">
              Multiplicadores y montos fijos sobre el precio base de cada servicio.
            </p>
          </div>
          {canManage ? (
            <TarifaForm
              zonaId={zona.id}
              servicios={serviciosCatalog.rows.map((s) => ({
                id: s.id,
                nombre: s.nombre,
                categoria_nombre: s.categoria_nombre,
              }))}
            />
          ) : null}
        </div>

        {tarifas.length === 0 ? (
          <EmptyState
            title="Sin tarifas"
            description="Esta zona usa los precios base del catálogo. Agrega tarifas si necesitas ajustar."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Servicio</th>
                  <th className="px-4 py-2.5 text-left font-medium">Tipo</th>
                  <th className="px-4 py-2.5 text-right font-medium">Valor</th>
                  <th className="hidden px-4 py-2.5 text-left font-medium md:table-cell">
                    Vigencia
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium">Estado</th>
                  {canManage ? (
                    <th className="w-44 px-4 py-2.5 text-right font-medium">Acciones</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tarifas.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{t.servicio_nombre}</div>
                      <div className="text-xs text-muted-foreground">{t.categoria_nombre}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {t.tipo_ajuste === 'multiplicador' ? 'Multiplicador' : 'Monto fijo'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums">
                      {t.tipo_ajuste === 'multiplicador'
                        ? `× ${Number(t.valor).toFixed(2)}`
                        : `+ ${formatMoneda(t.valor)}`}
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-xs text-muted-foreground md:table-cell">
                      {formatFechaCorta(t.vigencia_inicio)} →{' '}
                      {t.vigencia_fin ? formatFechaCorta(t.vigencia_fin) : 'sin fin'}
                    </td>
                    <td className="px-4 py-3">
                      {t.activa ? (
                        <Badge variant="success">Activa</Badge>
                      ) : (
                        <Badge variant="muted">Pausada</Badge>
                      )}
                    </td>
                    {canManage ? (
                      <td className="px-4 py-3 text-right">
                        <TarifaRowActions
                          zonaId={zona.id}
                          tarifaId={t.id}
                          activa={t.activa}
                        />
                      </td>
                    ) : null}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">{value}</p>
    </div>
  );
}
