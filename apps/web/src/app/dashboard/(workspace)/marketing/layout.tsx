import { redirect } from 'next/navigation';
import { tieneAlgunPermiso } from '@/lib/dashboard/rbac';
import { requireViewer } from '@/lib/dashboard/auth-gate';

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await requireViewer();
  const ok = tieneAlgunPermiso(viewer, ['cupones.gestionar', 'banners.gestionar']);
  if (!ok) redirect('/dashboard');

  return (
    <div
      className="contents"
      style={{ '--workspace-accent': 'hsl(var(--module-marketing))' } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
