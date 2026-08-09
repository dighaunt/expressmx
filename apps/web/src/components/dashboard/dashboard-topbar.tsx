import Link from 'next/link';
import { appsParaViewerPorGrupo, type App } from '@/lib/dashboard/apps';
import { type Viewer } from '@/lib/dashboard/rbac';
import { AppsMenu } from '@/components/dashboard/apps-menu';
import { UserMenu } from '@/components/dashboard/user-menu';
import { LogoExpressMX } from '@/components/brand/logo-expressmx';

function toMenuItem(a: App) {
  const Icon = a.icon;
  return {
    id: a.id,
    label: a.label,
    description: a.description,
    href: a.href,
    iconSm: <Icon size={16} aria-hidden />,
    iconLg: <Icon size={20} aria-hidden />,
    iconClassName: a.iconClassName,
  };
}

export function DashboardTopbar({ viewer }: { viewer: Viewer }) {
  const grupos = appsParaViewerPorGrupo(viewer);
  const workspace = grupos.workspace.map(toMenuItem);

  return (
    <header className="sticky top-0 z-40 w-full shrink-0 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link
            href="/dashboard"
            aria-label="ExpressMX"
            className="flex shrink-0 items-center"
          >
            <LogoExpressMX width={100} className="h-auto w-[100px] sm:w-[120px]" priority />
          </Link>
        </div>

        <nav className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          <AppsMenu workspace={workspace} />
          <UserMenu
            email={viewer.email}
            nombre={`${viewer.nombre} ${viewer.apellidos}`.trim()}
            avatarUrl={viewer.avatarUrl}
          />
        </nav>
      </div>
    </header>
  );
}
