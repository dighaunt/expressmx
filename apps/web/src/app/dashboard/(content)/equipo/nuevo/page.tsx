import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from '@phosphor-icons/react/ssr';
import { AsignarAdminForm } from '@/components/dashboard/asignar-admin-form';
import { PageHeader } from '@/components/dashboard/page-header';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { rolesActivos } from '@/lib/dashboard/queries/equipo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Asignar acceso · ExpressMX' };

export default async function AsignarAdminPage() {
  await requirePermiso('roles.gestionar');
  const roles = await rolesActivos();

  return (
    <>
      <Link
        href="/dashboard/equipo"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} aria-hidden /> Volver al equipo
      </Link>

      <PageHeader
        title="Asignar acceso administrativo"
        description="Busca un usuario existente y asígnale un rol para darle acceso al panel."
      />

      <div className="max-w-2xl">
        <AsignarAdminForm roles={roles} />
      </div>
    </>
  );
}
