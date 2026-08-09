import { requirePermiso } from '@/lib/dashboard/auth-gate';

export default async function OperacionesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermiso('operaciones.ver');
  return (
    <div
      className="contents"
      style={{ '--workspace-accent': 'hsl(var(--module-operaciones))' } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
