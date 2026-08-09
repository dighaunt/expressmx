import { redirect } from 'next/navigation';
import { tieneAlgunPermiso } from '@/lib/dashboard/rbac';
import { requireViewer } from '@/lib/dashboard/auth-gate';

export default async function RRHHLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await requireViewer();
  const ok = tieneAlgunPermiso(viewer, [
    'prestadores.revisar_docs',
    'prestadores.invitar',
    'prestadores.aprobar',
  ]);
  if (!ok) redirect('/dashboard');

  return (
    <div
      className="contents"
      style={{ '--workspace-accent': 'hsl(var(--module-rrhh))' } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
