import { requirePermiso } from '@/lib/dashboard/auth-gate';

export default async function SoporteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermiso('soporte.abrir_caso');
  return (
    <div
      className="contents"
      style={{ '--workspace-accent': 'hsl(var(--module-soporte))' } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
