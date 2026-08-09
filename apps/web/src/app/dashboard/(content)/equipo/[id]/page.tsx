import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Envelope,
  ShieldCheck,
  ShieldSlash,
  UserCircle,
} from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { EquipoControls } from '@/components/dashboard/equipo-controls';
import { PageHeader } from '@/components/dashboard/page-header';
import { WorkspaceBreadcrumbs } from '@/components/workspace';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { etiquetaDeRol } from '@/lib/dashboard/rbac';
import { formatFechaLarga, formatFechaHora } from '@/lib/dashboard/format';
import { getAdmin, rolesActivos } from '@/lib/dashboard/queries/equipo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Acceso administrativo · ExpressMX' };

export default async function AdminDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requirePermiso('roles.gestionar');
  const { id } = await params;

  const [admin, roles] = await Promise.all([getAdmin(id), rolesActivos()]);
  if (!admin) notFound();

  const esYoMismo = admin.usuario_id === viewer.userId;

  return (
    <>
      <WorkspaceBreadcrumbs
        className="mb-3"
        items={[
          { label: 'Equipo', href: '/dashboard/equipo' },
          { label: `${admin.nombre} ${admin.apellidos}` },
        ]}
      />

      <PageHeader
        title={`${admin.nombre} ${admin.apellidos}`}
        description={admin.email}
        actions={
          admin.activo ? (
            <Badge variant="success">Activo</Badge>
          ) : (
            <Badge variant="muted">Suspendido</Badge>
          )
        }
      />

      <section className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Persona
          </h2>
          <ul className="space-y-3 text-sm">
            <li className="flex items-center gap-3">
              <UserCircle size={18} className="text-muted-foreground" aria-hidden />
              <span>
                {admin.nombre} {admin.apellidos}
              </span>
            </li>
            <li className="flex items-center gap-3">
              <Envelope size={18} className="text-muted-foreground" aria-hidden />
              <span>{admin.email}</span>
            </li>
            <li className="flex items-center gap-3">
              {admin.activo ? (
                <ShieldCheck size={18} className="text-success" aria-hidden />
              ) : (
                <ShieldSlash size={18} className="text-muted-foreground" aria-hidden />
              )}
              <span>
                Acceso desde {formatFechaLarga(admin.created_at)}
                {admin.ultimo_acceso ? (
                  <>
                    {' · último uso '}
                    {formatFechaHora(admin.ultimo_acceso)}
                  </>
                ) : null}
              </span>
            </li>
          </ul>
        </div>

        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Rol asignado
          </h2>
          <p className="text-base font-semibold">{etiquetaDeRol(admin.rol_nombre)}</p>
          <p className="font-mono text-xs text-muted-foreground">{admin.rol_nombre}</p>
          {admin.rol_descripcion ? (
            <p className="mt-2 text-sm text-muted-foreground">{admin.rol_descripcion}</p>
          ) : null}
          <Link
            href={`/dashboard/roles/${admin.rol_id}`}
            className="mt-3 inline-block text-xs text-primary underline-offset-2 hover:underline"
          >
            Ver permisos del rol ({admin.permisos_count})
          </Link>
          {!admin.rol_activo ? (
            <p className="mt-2 text-xs text-warning-foreground">
              El rol está inactivo: cámbialo para reactivar el acceso.
            </p>
          ) : null}
        </div>
      </section>

      <EquipoControls
        adminId={admin.id}
        rolActualId={admin.rol_id}
        activo={admin.activo}
        roles={roles}
        esYoMismo={esYoMismo}
      />
    </>
  );
}
