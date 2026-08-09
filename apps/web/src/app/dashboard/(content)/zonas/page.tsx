import type { Metadata } from 'next';
import Link from 'next/link';
import { CaretRight, MapTrifold, Plus } from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { PageHeader } from '@/components/dashboard/page-header';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';
import { formatNumero } from '@/lib/dashboard/format';
import {
  ESTATUS_ZONA_LABEL,
  listarZonas,
  type EstatusZona,
} from '@/lib/dashboard/queries/zonas';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Zonas · ExpressMX' };

const VARIANT_BY_ESTATUS: Record<EstatusZona, 'success' | 'warning' | 'destructive'> = {
  activa: 'success',
  en_expansion: 'warning',
  suspendida: 'destructive',
};

export default async function ZonasPage() {
  const viewer = await requirePermiso('zonas.ver');
  const zonas = await listarZonas();
  const canManage = tienePermiso(viewer, 'zonas.gestionar');

  return (
    <>
      <PageHeader
        title="Zonas de cobertura"
        description={`${formatNumero(zonas.length)} zonas configuradas`}
        actions={
          canManage ? (
            <Link
              href="/dashboard/zonas/nueva"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus size={14} aria-hidden />
              Nueva zona
            </Link>
          ) : null
        }
      />

      {zonas.length === 0 ? (
        <EmptyState
          icon={MapTrifold}
          title="Sin zonas"
          description="Crea la primera zona para empezar a recibir órdenes en esa área."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Zona</th>
                <th className="hidden px-4 py-2.5 text-left font-medium md:table-cell">
                  Centro
                </th>
                <th className="hidden px-4 py-2.5 text-right font-medium md:table-cell">
                  Radio
                </th>
                <th className="px-4 py-2.5 text-right font-medium">Tarifas</th>
                <th className="hidden px-4 py-2.5 text-right font-medium lg:table-cell">
                  Prestadores
                </th>
                <th className="px-4 py-2.5 text-left font-medium">Estado</th>
                <th className="w-10 px-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {zonas.map((z) => (
                <tr key={z.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{z.nombre}</td>
                  <td className="hidden px-4 py-3 font-mono text-xs text-muted-foreground md:table-cell">
                    {Number(z.centro_lat).toFixed(4)}, {Number(z.centro_lng).toFixed(4)}
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-right text-muted-foreground tabular-nums md:table-cell">
                    {z.radio_km ? `${Number(z.radio_km).toFixed(1)} km` : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                    {formatNumero(z.tarifas_count)}
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-right tabular-nums lg:table-cell">
                    {formatNumero(z.prestadores_count)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={VARIANT_BY_ESTATUS[z.estatus]}>
                      {ESTATUS_ZONA_LABEL[z.estatus]}
                    </Badge>
                  </td>
                  <td className="px-2">
                    <Link
                      href={`/dashboard/zonas/${z.id}`}
                      className="inline-flex items-center text-muted-foreground hover:text-foreground"
                    >
                      <CaretRight size={16} aria-hidden />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
