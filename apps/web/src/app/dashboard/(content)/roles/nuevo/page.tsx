import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from '@phosphor-icons/react/ssr';
import { PageHeader } from '@/components/dashboard/page-header';
import { RolForm } from '@/components/dashboard/rol-form';
import { requirePermiso } from '@/lib/dashboard/auth-gate';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Nuevo rol · ExpressMX' };

export default async function NuevoRolPage() {
  await requirePermiso('roles.gestionar');

  return (
    <>
      <Link
        href="/dashboard/roles"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} aria-hidden /> Volver a roles
      </Link>

      <PageHeader
        title="Nuevo rol"
        description="Crea el rol primero. Después podrás asignarle permisos uno por uno."
      />

      <div className="max-w-xl">
        <RolForm mode="create" />
      </div>
    </>
  );
}
