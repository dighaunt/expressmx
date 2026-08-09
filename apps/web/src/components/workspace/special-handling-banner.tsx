import { Warning, WarningOctagon } from '@phosphor-icons/react/ssr';
import type { ClienteAnotacion } from '@/lib/dashboard/queries/anotaciones';

interface Props {
  anotaciones: ClienteAnotacion[];
}

const SEVERIDAD_TONE = {
  critica: 'border-destructive bg-destructive/10 text-destructive',
  alta: 'border-warning bg-warning/10 text-warning-foreground',
  media: 'border-muted bg-muted/30 text-foreground',
  info: 'border-muted bg-muted/20 text-muted-foreground',
} as const;

const SEVERIDAD_LABEL = {
  critica: 'Crítico',
  alta: 'Importante',
  media: 'Aviso',
  info: 'Nota',
} as const;

export function SpecialHandlingBanner({ anotaciones }: Props) {
  const altas = anotaciones.filter(
    (a) => a.severidad === 'critica' || a.severidad === 'alta',
  );
  if (altas.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {altas.map((a) => {
        const Icon = a.severidad === 'critica' ? WarningOctagon : Warning;
        const tone = SEVERIDAD_TONE[a.severidad];
        return (
          <div
            key={a.id}
            className={`flex items-start gap-2 rounded-md border-l-4 px-3 py-2 ${tone}`}
            role="alert"
          >
            <Icon size={16} weight="duotone" aria-hidden className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                <span>{SEVERIDAD_LABEL[a.severidad]}</span>
                <span className="text-[10px] font-normal opacity-70">·</span>
                <span className="truncate text-[12px] normal-case font-semibold">
                  {a.titulo}
                </span>
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-[12px] leading-snug">
                {a.cuerpo_md}
              </p>
              <p className="mt-1 text-[10px] opacity-70">
                Por {a.creada_por_nombre}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
