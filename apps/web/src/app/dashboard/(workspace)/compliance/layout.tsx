import { requirePermiso } from '@/lib/dashboard/auth-gate';

export default async function ComplianceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermiso('auditoria.ver');
  return (
    <div
      className="contents"
      style={{ '--workspace-accent': 'hsl(var(--module-compliance))' } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
