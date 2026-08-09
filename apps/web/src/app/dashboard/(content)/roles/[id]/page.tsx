import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/dashboard/page-header';
import { PermisosGrid } from '@/components/dashboard/permisos-grid';
import { RolForm } from '@/components/dashboard/rol-form';
import { WorkspaceBreadcrumbs } from '@/components/workspace';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { etiquetaDeRol } from '@/lib/dashboard/rbac';
import { formatFechaLarga, formatNumero } from '@/lib/dashboard/format';
import { getRol, listarPermisosAgrupados } from '@/lib/dashboard/queries/roles';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Rol · ExpressMX' };

const PROTEGIDOS = new Set(['super_admin']);

export default async function RolDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermiso('roles.gestionar');
  const { id } = await params;

  const [rol, modulos] = await Promise.all([getRol(id), listarPermisosAgrupados()]);
  if (!rol) notFound();

  const protegido = PROTEGIDOS.has(rol.nombre);
  const asignados = new Set(rol.permisos_asignados);

  return (
    <>
      <WorkspaceBreadcrumbs
        className="mb-3"
        items={[
          { label: 'Roles', href: '/dashboard/roles' },
          { label: etiquetaDeRol(rol.nombre) },
        ]}
      />

      <PageHeader
        title={etiquetaDeRol(rol.nombre)}
        description={`Creado el ${formatFechaLarga(rol.created_at)}`}
        actions={
          protegido ? (
            <Badge variant="warning">Rol del sistema</Badge>
          ) : !rol.activo ? (
            <Badge variant="muted">Inactivo</Badge>
          ) : (
            <Badge variant="success">Activo</Badge>
          )
        }
      />

      <section className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Definición del rol
          </h2>
          <RolForm
            mode="edit"
            rolId={rol.id}
            initial={{
              nombre: rol.nombre,
              descripcion: rol.descripcion ?? '',
              activo: rol.activo,
            }}
            adminsAsignados={rol.count_admins_activos}
            protegido={protegido}
          />
        </div>

        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Uso
          </h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-muted-foreground">Permisos asignados</dt>
              <dd className="text-2xl font-semibold tabular-nums">
                {formatNumero(rol.permisos_asignados.length)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Administradores activos</dt>
              <dd className="text-2xl font-semibold tabular-nums">
                {formatNumero(rol.count_admins_activos)}
              </dd>
            </div>
            {rol.count_admins > rol.count_admins_activos ? (
              <p className="text-xs text-muted-foreground">
                {formatNumero(rol.count_admins - rol.count_admins_activos)} desactivados
              </p>
            ) : null}
          </dl>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Permisos
            </h2>
            <p className="text-xs text-muted-foreground">
              {protegido
                ? 'Este rol tiene acceso total y no requiere asignación explícita.'
                : 'Marca cada permiso para incluirlo. Los cambios se guardan al instante.'}
            </p>
          </div>
        </header>

        <PermisosGrid
          rolId={rol.id}
          modulos={modulos}
          asignados={Array.from(asignados)}
          deshabilitado={protegido}
        />
      </section>
    </>
  );
}
