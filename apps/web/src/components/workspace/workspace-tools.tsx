import Link from 'next/link';
import { appsParaViewerPorGrupo, type AppGroup } from '@/lib/dashboard/apps';
import type { Viewer } from '@/lib/dashboard/rbac-shared';
import { cn } from '@/lib/utils';

type ToolGroup = Exclude<AppGroup, 'workspace'>;

interface Props {
  viewer: Viewer;
  groups: ReadonlyArray<ToolGroup>;
  compact?: boolean;
}

export function WorkspaceTools({ viewer, groups, compact }: Props) {
  const sections = appsParaViewerPorGrupo(viewer).sections.filter((section) =>
    groups.includes(section.id),
  );
  const tools = sections.flatMap((section) => section.apps);

  if (tools.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No tienes herramientas adicionales en este workspace.
      </p>
    );
  }

  return (
    <ul className={cn('grid gap-1.5', compact ? 'grid-cols-1' : 'sm:grid-cols-2')}>
      {tools.map((tool) => {
        const Icon = tool.icon;
        return (
          <li key={tool.id}>
            <Link
              href={tool.href}
              className="flex items-start gap-2 rounded-md border border-border bg-background p-2 text-xs transition-colors hover:bg-muted/50"
            >
              <span
                className={cn(
                  'mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md',
                  tool.iconClassName,
                )}
              >
                <Icon size={14} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold leading-tight text-foreground">
                  {tool.label}
                </span>
                <span className="mt-0.5 block leading-tight text-muted-foreground">
                  {tool.description}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
