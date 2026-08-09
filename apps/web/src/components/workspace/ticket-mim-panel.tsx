'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LinkSimple, WarningOctagon } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { vincularTicketAMim } from '@/lib/dashboard/actions/mim-crud';
import {
  ESTADO_MIM_LABEL,
  type MajorIncidentSummary,
} from '@/lib/dashboard/mim-shared';
import { formatFechaHora } from '@/lib/dashboard/format';

interface Props {
  ticketId: string;
  mimVinculado: MajorIncidentSummary | null;
  mimActivos: MajorIncidentSummary[];
  puedeVincular: boolean;
}

const ESTADO_TONE: Record<
  MajorIncidentSummary['estado'],
  'destructive' | 'warning' | 'success' | 'muted'
> = {
  declarado: 'destructive',
  mitigando: 'warning',
  resuelto: 'success',
  pir_pendiente: 'warning',
  cerrado: 'muted',
};

export function TicketMimPanel({
  ticketId,
  mimVinculado,
  mimActivos,
  puedeVincular,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const candidatos = mimActivos.filter((m) => m.id !== mimVinculado?.id);

  function handleLink(mimId: string) {
    startTransition(async () => {
      const r = await vincularTicketAMim({ ticketId, mimId });
      if (r.ok) {
        toast.success('Ticket vinculado al Major Incident');
        router.refresh();
      } else {
        toast.error(r.message ?? 'No pudimos vincular el ticket');
      }
    });
  }

  return (
    <div className="space-y-3 text-xs">
      {mimVinculado ? (
        <Link
          href={`/dashboard/soporte/mim/${mimVinculado.id}`}
          className="block rounded-md border border-destructive/30 bg-destructive/5 p-2 hover:bg-destructive/10"
        >
          <div className="mb-1 flex items-start justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 font-medium text-foreground">
              <WarningOctagon size={14} weight="fill" className="text-destructive" aria-hidden />
              <span className="truncate">{mimVinculado.titulo}</span>
            </span>
            <Badge variant={ESTADO_TONE[mimVinculado.estado]}>
              {ESTADO_MIM_LABEL[mimVinculado.estado]}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Declarado {formatFechaHora(mimVinculado.declarado_at)} ·{' '}
            {mimVinculado.tickets_vinculados} tickets
          </p>
        </Link>
      ) : (
        <p className="rounded-md border border-dashed border-border bg-background p-3 text-muted-foreground">
          Este ticket no está vinculado a un Major Incident.
        </p>
      )}

      {puedeVincular && candidatos.length > 0 ? (
        <div className="space-y-1.5">
          {candidatos.map((m) => (
            <div
              key={m.id}
              className="rounded-md border border-border bg-background p-2"
            >
              <div className="mb-1 flex items-start justify-between gap-2">
                <p className="min-w-0 truncate font-medium">{m.titulo}</p>
                <Badge variant={ESTADO_TONE[m.estado]}>
                  {ESTADO_MIM_LABEL[m.estado]}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">
                  {m.servicios_afectados.length > 0
                    ? m.servicios_afectados.join(', ')
                    : 'Sin servicio marcado'}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleLink(m.id)}
                  disabled={pending}
                  className="h-7 shrink-0 px-2 text-[11px]"
                >
                  <LinkSimple size={12} aria-hidden />
                  Vincular
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {puedeVincular && candidatos.length === 0 && !mimVinculado ? (
        <Link
          href="/dashboard/soporte/mim/declarar"
          className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted"
        >
          <WarningOctagon size={13} aria-hidden />
          Declarar Major Incident
        </Link>
      ) : null}
    </div>
  );
}
