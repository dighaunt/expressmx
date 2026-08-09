import { requirePermiso } from '@/lib/dashboard/auth-gate';

export default async function FinanzasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermiso('finanzas.ver');
  return (
    <div
      className="contents"
      style={{ '--workspace-accent': 'hsl(var(--module-finanzas))' } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
