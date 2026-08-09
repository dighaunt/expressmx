import Link from 'next/link';
import { WarningCircle } from '@phosphor-icons/react/ssr';
import {
  ESTADO_MIM_LABEL,
  type MajorIncidentSummary,
} from '@/lib/dashboard/mim-shared';
import { formatFechaHora } from '@/lib/dashboard/format';

interface Props {
  incidents: ReadonlyArray<MajorIncidentSummary>;
}

export function MimBanner({ incidents }: Props) {
  if (incidents.length === 0) return null;
  const top = incidents[0];
  if (!top) return null;
  const restantes = incidents.length - 1;

  return (
    <div className="shrink-0 border-b border-destructive/40 bg-destructive/10">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2">
        <WarningCircle
          size={18}
          weight="fill"
          className="shrink-0 text-destructive"
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-destructive">
            Major Incident — {ESTADO_MIM_LABEL[top.estado]}
          </p>
          <p className="truncate text-sm font-medium">
            {top.titulo}
            {restantes > 0 ? (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                + {restantes} {restantes === 1 ? 'incidente activo' : 'incidentes activos'}
              </span>
            ) : null}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Declarado {formatFechaHora(top.declarado_at)} · {top.tickets_vinculados} tickets vinculados
          </p>
        </div>
        <Link
          href={`/dashboard/soporte/mim/${top.id}`}
          className="shrink-0 rounded-md bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90"
        >
          Ver war room
        </Link>
      </div>
    </div>
  );
}
