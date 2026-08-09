import { requireViewer } from '@/lib/dashboard/auth-gate';

export default async function MiCuentaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireViewer();
  return (
    <div
      className="contents"
      style={{ '--workspace-accent': 'hsl(var(--module-mi))' } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
