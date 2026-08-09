import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowSquareOut, Calendar, Clock } from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { CambiarPasswordForm } from '@/components/dashboard/cambiar-password-form';
import { CuentaForm } from '@/components/dashboard/cuenta-form';
import { MiCuentaQueue } from '@/components/dashboard/mi-cuenta-queue';
import {
  ContextSidebar,
  ItemForm,
  WorkspaceShell,
} from '@/components/workspace';
import { requireViewer } from '@/lib/dashboard/auth-gate';
import { etiquetaDeRol } from '@/lib/dashboard/rbac';
import { formatFechaHora, formatFechaLarga, formatNumero } from '@/lib/dashboard/format';
import { getPerfil } from '@/lib/dashboard/queries/cuenta';
import {
  getMiActividad,
  getMiResumen,
  getMisPermisos,
} from '@/lib/dashboard/queries/mi-cuenta';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Mi cuenta · ExpressMX' };

type Tab = 'perfil' | 'seguridad' | 'actividad' | 'permisos';

interface SearchParams {
  tab?: string;
}

export default async function MiCuentaWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await requireViewer();
  const sp = await searchParams;
  const tab = (sp.tab ?? 'perfil') as Tab;

  const [perfil, resumen, actividad, permisos] = await Promise.all([
    getPerfil(viewer.userId),
    getMiResumen(viewer.userId),
    tab === 'actividad' ? getMiActividad(viewer.userId, 50) : Promise.resolve([]),
    tab === 'permisos' ? getMisPermisos(viewer.userId) : Promise.resolve(null),
  ]);
  if (!perfil) notFound();

  return (
    <WorkspaceShell
      header={
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Workspace
          </p>
          <h1 className="text-base font-semibold">
            Mi cuenta · {perfil.nombre} {perfil.apellidos}
          </h1>
        </div>
      }
      queue={<MiCuentaQueue active={tab} />}
      main={
        tab === 'perfil' ? (
          <ItemForm
            title="Perfil"
            subtitle={perfil.email}
            badges={
              perfil.rol_admin ? (
                <Badge variant="default">{etiquetaDeRol(perfil.rol_admin)}</Badge>
              ) : null
            }
            meta={
              <span>
                {perfil.rol_admin
                  ? `Acceso administrativo: ${etiquetaDeRol(perfil.rol_admin)} · `
                  : ''}
                Cuenta creada {formatFechaLarga(perfil.created_at)}
                {perfil.ultimo_acceso
                  ? ` · último acceso ${formatFechaHora(perfil.ultimo_acceso)}`
                  : ''}
              </span>
            }
            fields={
              <CuentaForm
                initial={{
                  nombre: perfil.nombre,
                  apellidos: perfil.apellidos,
                  telefono: perfil.telefono ?? '',
                  avatar_url: perfil.avatar_url ?? '',
                }}
                email={perfil.email}
              />
            }
          />
        ) : tab === 'seguridad' ? (
          <ItemForm
            title="Seguridad"
            subtitle="Cambia tu contraseña. La sesión actual no se invalida automáticamente."
            fields={<CambiarPasswordForm tieneCredenciales={perfil.tiene_credenciales} />}
          />
        ) : tab === 'actividad' ? (
          <ItemForm
            title="Mi actividad"
            subtitle={`${formatNumero(actividad.length)} acciones recientes`}
            activity={
              actividad.length === 0 ? (
                <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Aún no has ejecutado acciones que modifiquen datos.
                </p>
              ) : (
                <ul className="space-y-1">
                  {actividad.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-border bg-card p-2 text-xs"
                    >
                      <Link
                        href={`/dashboard/compliance/evento/${a.id}`}
                        className="font-mono text-primary hover:underline"
                      >
                        {a.accion}
                      </Link>
                      <span className="text-muted-foreground">
                        {a.entidad} · {formatFechaHora(a.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )
            }
          />
        ) : (
          <ItemForm
            title="Mis permisos"
            subtitle={
              permisos?.rol_admin
                ? `Rol: ${etiquetaDeRol(permisos.rol_admin)} (${permisos.rol_admin})`
                : 'Sin rol administrativo asignado'
            }
            meta={
              permisos?.rol_descripcion ? (
                <span>{permisos.rol_descripcion}</span>
              ) : null
            }
            fields={
              permisos && permisos.permisos.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Tienes {formatNumero(permisos.permisos.length)} permisos efectivos. Si
                    necesitas más capacidades, pídele a un super admin que ajuste tu rol.
                  </p>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {permisos.permisos.map((p) => (
                      <code
                        key={p}
                        className="rounded-md border border-border bg-card px-2 py-1 font-mono text-xs"
                      >
                        {p}
                      </code>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No tienes permisos administrativos asignados. Solicita acceso a un super
                  admin si crees que es un error.
                </p>
              )
            }
          />
        )
      }
      context={
        <ContextSidebar
          sections={[
            {
              key: 'resumen',
              title: 'Mi actividad',
              children: (
                <dl className="space-y-2 text-sm">
                  <Stat
                    icon={Clock}
                    label="Acciones hoy"
                    value={formatNumero(resumen.acciones_hoy)}
                  />
                  <Stat
                    icon={Calendar}
                    label="Últimos 7 días"
                    value={formatNumero(resumen.acciones_7d)}
                  />
                  <Stat
                    label="Casos de soporte (30d)"
                    value={formatNumero(resumen.casos_atendidos_30d)}
                  />
                  <Stat
                    label="Tickets resueltos (30d)"
                    value={formatNumero(resumen.tickets_resueltos_30d)}
                  />
                </dl>
              ),
            },
            {
              key: 'tip',
              title: 'Cumplimiento',
              children: (
                <p className="text-xs text-muted-foreground">
                  Cada acción que afecta datos queda registrada en{' '}
                  <Link
                    href="/dashboard/compliance"
                    className="inline-flex items-center gap-0.5 text-primary hover:underline"
                  >
                    Compliance <ArrowSquareOut size={10} aria-hidden />
                  </Link>
                  . Tú puedes ver tu historial completo en la pestaña "Mi actividad".
                </p>
              ),
            },
          ]}
        />
      }
    />
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon ? <Icon size={12} aria-hidden /> : null}
        {label}
      </span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
