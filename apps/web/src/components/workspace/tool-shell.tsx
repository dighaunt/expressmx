import Link from 'next/link';
import { ArrowSquareOut } from '@phosphor-icons/react/ssr';
import type { WorkspaceToolContext } from '@/lib/dashboard/tool-registry';
import { WorkspaceBreadcrumbs } from '@/components/workspace/workspace-breadcrumbs';

interface Props {
  context: WorkspaceToolContext | null;
  children: React.ReactNode;
}

export function ToolShell({ context, children }: Props) {
  if (!context) return <>{children}</>;

  return (
    <div>
      <nav className="mb-4 border-b border-border pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <WorkspaceBreadcrumbs
            items={[
              { label: context.workspaceLabel, href: context.workspaceHref },
              { label: context.label },
            ]}
          />
          <Link
            href={context.workspaceHref}
            className="inline-flex h-8 w-fit shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {context.workspaceLabel}
            <ArrowSquareOut size={12} aria-hidden />
          </Link>
        </div>
      </nav>
      {children}
    </div>
  );
}
