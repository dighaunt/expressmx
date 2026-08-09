import Link from 'next/link';
import { Books } from '@phosphor-icons/react/ssr';
import { getKbSugerencias } from '@/lib/dashboard/queries/kb';
import type { PlaybookStage } from '@/lib/dashboard/playbooks';

interface Props {
  asunto: string;
  categoria?: string | null;
  tipo?: string | null;
  ticketId?: string;
  hrefBase?: string;
  playbookStage?: PlaybookStage | null;
}

export async function KbSuggestionPanel({
  asunto,
  categoria,
  tipo,
  ticketId,
  hrefBase = '/dashboard/soporte/kb/articulo',
  playbookStage,
}: Props) {
  const stageHint = playbookStage?.state === 'active'
    ? `${playbookStage.label} ${playbookStage.hint}`
    : '';
  const queryText = stageHint ? `${asunto} ${stageHint}` : asunto;

  const sugerencias = await getKbSugerencias({
    asunto: queryText,
    categoria: categoria ?? null,
    tipo: tipo ?? null,
    limit: 5,
  });

  if (sugerencias.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Sin sugerencias automáticas. Usa la búsqueda del KB.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {playbookStage && playbookStage.state === 'active' ? (
        <p className="text-[11px] text-muted-foreground">
          Sugerencias para la etapa <span className="font-medium text-foreground">{playbookStage.label}</span>.
        </p>
      ) : null}
      <ul className="space-y-1.5">
        {sugerencias.map((s) => {
          const href = ticketId
            ? `${hrefBase}/${s.slug}?ticket=${ticketId}`
            : `${hrefBase}/${s.slug}`;
          return (
            <li key={s.id}>
              <Link
                href={href}
                className="flex items-start gap-2 rounded-md border border-border bg-background p-2 hover:border-primary/40 hover:bg-muted/40"
              >
                <Books size={14} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="line-clamp-2 text-xs font-medium">{s.titulo}</p>
                  {s.resumen ? (
                    <p className="line-clamp-1 text-[11px] text-muted-foreground">
                      {s.resumen}
                    </p>
                  ) : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
