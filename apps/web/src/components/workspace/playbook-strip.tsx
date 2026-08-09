import { CaretRight, CheckCircle, Circle, Lock } from '@phosphor-icons/react/ssr';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type {
  Playbook,
  PlaybookAction,
  PlaybookStage,
} from '@/lib/dashboard/playbooks';

interface Props {
  playbook: Playbook;
  actions?: ReadonlyArray<PlaybookAction>;
}

const STAGE_CONTAINER: Record<PlaybookStage['state'], string> = {
  done: 'border-success/40 bg-success/10 text-foreground',
  active:
    'border-primary bg-primary/10 text-foreground ring-1 ring-primary/30',
  locked: 'border-border bg-muted/40 text-muted-foreground',
};

const STAGE_DOT: Record<PlaybookStage['state'], string> = {
  done: 'bg-success text-white',
  active: 'bg-primary text-primary-foreground',
  locked: 'bg-muted-foreground/20 text-muted-foreground',
};

const STAGE_STATE_LABEL: Record<PlaybookStage['state'], string> = {
  done: 'Completado',
  active: 'En curso',
  locked: 'Pendiente',
};

function StageIcon({ state }: { state: PlaybookStage['state'] }) {
  if (state === 'done') return <CheckCircle size={14} weight="fill" aria-hidden />;
  if (state === 'active') return <Circle size={14} weight="duotone" aria-hidden />;
  return <Lock size={12} weight="fill" aria-hidden />;
}

export function PlaybookStrip({ playbook, actions = [] }: Props) {
  if (playbook.stages.length === 0) return null;
  const activeStage = playbook.stages.find((stage) => stage.state === 'active');

  return (
    <Card
      aria-label={`Playbook ${playbook.nombre}`}
      className="rounded-md p-2.5 shadow-none"
    >
      <div className="flex items-center justify-between gap-2 pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Playbook
          </span>
          <span className="truncate text-xs font-medium text-foreground">
            {playbook.nombre}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Progress
            value={playbook.progreso_pct}
            aria-label={`Progreso ${playbook.progreso_pct}%`}
            className="w-24"
          />
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {playbook.progreso_pct}%
          </span>
        </div>
      </div>

      <ol className="flex flex-wrap items-stretch gap-1.5">
        {playbook.stages.map((stage, i) => (
          <li key={stage.id} className="flex flex-1 min-w-[140px] items-stretch">
            <div
              title={stage.hint}
              className={cn(
                'flex flex-1 cursor-help items-center gap-2 rounded-md border px-2 py-1.5 transition-colors',
                STAGE_CONTAINER[stage.state],
              )}
            >
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                  STAGE_DOT[stage.state],
                )}
              >
                <StageIcon state={stage.state} />
              </span>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-[11px] font-medium leading-tight">
                  {i + 1}. {stage.label}
                </p>
                <p className="truncate text-[10px] leading-tight opacity-70">
                  {STAGE_STATE_LABEL[stage.state]}
                </p>
              </div>
              {i < playbook.stages.length - 1 ? (
                <CaretRight
                  size={10}
                  aria-hidden
                  className="hidden shrink-0 opacity-40 sm:block"
                />
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      {activeStage && actions.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Siguiente
          </span>
          <span className="text-[10px] text-muted-foreground">
            {activeStage.label}
          </span>
          <div className="ml-auto flex flex-wrap justify-end gap-1.5">
            {actions.map((action) => (
              <a
                key={action.id}
                href={action.href}
                className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/15"
              >
                {action.label}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
