import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  Bank,
  CalendarBlank,
  Envelope,
  IdentificationBadge,
  Phone,
  ShieldWarning,
  Star,
} from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { CuentaBancariaActions } from '@/components/dashboard/cuenta-bancaria-actions';
import { DocumentRow } from '@/components/dashboard/document-row';
import { EmptyState } from '@/components/dashboard/empty-state';
import { PageHeader } from '@/components/dashboard/page-header';
import { PrestadorServiciosForm } from '@/components/dashboard/prestador-servicios-form';
import { PrestadorTurnosForm } from '@/components/dashboard/prestador-turnos-form';
import { RestrictControls } from '@/components/dashboard/restrict-controls';
import { WorkspaceBreadcrumbs } from '@/components/workspace';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { mascaraClabe } from '@/lib/banking/clabe';
import { tienePermiso } from '@/lib/dashboard/rbac';
import {
  formatFechaCorta,
  formatFechaLarga,
  formatNumero,
} from '@/lib/dashboard/format';
import {
  aprobarDocumento,
  quitarRestriccionPrestador,
  rechazarDocumento,
  restringirPrestador,
} from '@/lib/dashboard/actions/prestadores';
import {
  getPrestador,
  listarDocumentosPrestador,
  listarServiciosAsignablesPrestador,
  listarTurnosPrestador,
} from '@/lib/dashboard/queries/prestadores';
import { listarZonas } from '@/lib/dashboard/queries/zonas';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Prestador · ExpressMX' };

export default async function PrestadorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requirePermiso('prestadores.ver');
  const { id } = await params;
  const prestador = await getPrestador(id);
  if (!prestador) notFound();

  const [docs, serviciosAsignables, turnos, zonas] = await Promise.all([
    listarDocumentosPrestador(id),
    listarServiciosAsignablesPrestador(id),
    listarTurnosPrestador(id),
    listarZonas(),
  ]);
  const puedeRevisarDocs = tienePermiso(viewer, 'prestadores.revisar_docs');
  const puedeRestringir = tienePermiso(viewer, 'prestadores.restringir');
  const puedeEditarPrestador = tienePermiso(viewer, 'prestadores.editar');
  const puedeValidarCuenta =
    tienePermiso(viewer, 'cortes.generar') || puedeEditarPrestador;

  const pendientes = docs.filter((d) => d.estatus === 'pendiente').length;
  const clabeMascara = mascaraClabe(prestador.cuenta_bancaria_clabe_ultimos4);

  return (
    <>
      <WorkspaceBreadcrumbs
        className="mb-3"
        items={[
          { label: 'Prestadores', href: '/dashboard/prestadores' },
          { label: `${prestador.nombre} ${prestador.apellidos}` },
        ]}
      />

      <PageHeader
        title={`${prestador.nombre} ${prestador.apellidos}`}
        description={prestador.email}
        actions={
          prestador.restringido ? (
            <Badge variant="destructive">Restringido</Badge>
          ) : !prestador.activo ? (
            <Badge variant="muted">Inactivo</Badge>
          ) : prestador.recibe_ordenes ? (
            <Badge variant="success">En turno</Badge>
          ) : (
            <Badge variant="muted">Fuera de turno</Badge>
          )
        }
      />

      <section className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Datos personales
          </h2>
          <ul className="space-y-3 text-sm">
            <li className="flex items-center gap-3">
              <Envelope size={18} className="text-muted-foreground" aria-hidden />
              <span>{prestador.email}</span>
            </li>
            {prestador.telefono ? (
              <li className="flex items-center gap-3">
                <Phone size={18} className="text-muted-foreground" aria-hidden />
                <span>{prestador.telefono}</span>
              </li>
            ) : null}
            <li className="flex items-center gap-3">
              <CalendarBlank size={18} className="text-muted-foreground" aria-hidden />
              <span>Empleado desde {formatFechaLarga(prestador.created_at)}</span>
            </li>
            {prestador.curp ? (
              <li className="flex items-center gap-3">
                <IdentificationBadge size={18} className="text-muted-foreground" aria-hidden />
                <span className="font-mono text-xs">{prestador.curp}</span>
              </li>
            ) : null}
          </ul>
        </div>

        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Desempeño
          </h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-muted-foreground">Servicios activos</dt>
              <dd className="text-2xl font-semibold tabular-nums">
                {formatNumero(prestador.servicios_count)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Órdenes completadas</dt>
              <dd className="text-2xl font-semibold tabular-nums">
                {formatNumero(prestador.ordenes_completadas)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Calificación promedio</dt>
              <dd className="flex items-center gap-1.5 text-lg font-semibold">
                {prestador.rating_promedio !== null ? (
                  <>
                    <Star size={16} className="text-warning" weight="fill" aria-hidden />
                    {prestador.rating_promedio.toFixed(1)}
                  </>
                ) : (
                  <span className="text-muted-foreground text-base">Sin calificaciones</span>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {prestador.restringido ? (
        <section className="mb-6 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <ShieldWarning size={20} className="text-destructive" aria-hidden />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-semibold text-destructive">
                Prestador restringido — no recibe órdenes
              </p>
              {prestador.motivo_restriccion ? (
                <p className="text-sm text-muted-foreground">
                  Motivo: {prestador.motivo_restriccion}
                </p>
              ) : null}
              {prestador.restringido_en ? (
                <p className="text-xs text-muted-foreground">
                  Aplicado el {formatFechaLarga(prestador.restringido_en)}
                </p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section className="mb-6">
        <PrestadorServiciosForm
          prestadorId={prestador.id}
          servicios={serviciosAsignables}
          canEdit={puedeEditarPrestador}
        />
      </section>

      <section className="mb-6">
        <PrestadorTurnosForm
          prestadorId={prestador.id}
          turnos={turnos}
          zonas={zonas}
          canEdit={puedeEditarPrestador}
        />
      </section>

      <section className="mb-6 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Cuenta bancaria
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              CLABE usada por Finanzas para cortes quincenales.
            </p>
          </div>
          {prestador.cuenta_bancaria_estatus ? (
            <Badge
              variant={
                prestador.cuenta_bancaria_estatus === 'verificada'
                  ? 'success'
                  : prestador.cuenta_bancaria_estatus === 'rechazada'
                    ? 'destructive'
                    : 'warning'
              }
            >
              {prestador.cuenta_bancaria_estatus}
            </Badge>
          ) : (
            <Badge variant="warning">pendiente</Badge>
          )}
        </div>
        {prestador.cuenta_bancaria_id ? (
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="flex items-center gap-3 sm:col-span-2">
              <Bank size={18} className="text-muted-foreground" aria-hidden />
              <div>
                <p className="font-medium">{prestador.cuenta_bancaria_banco}</p>
                <p className="text-xs text-muted-foreground">
                  Titular: {prestador.cuenta_bancaria_titular}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">CLABE</p>
              <p className="font-mono text-xs">{clabeMascara}</p>
            </div>
            {puedeValidarCuenta && prestador.cuenta_bancaria_estatus ? (
              <div className="sm:col-span-3">
                <CuentaBancariaActions
                  prestadorId={prestador.id}
                  cuentaId={prestador.cuenta_bancaria_id}
                  estatus={prestador.cuenta_bancaria_estatus}
                  titularInicial={prestador.cuenta_bancaria_titular}
                  bancoInicial={prestador.cuenta_bancaria_banco}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              RRHH todavía no ha capturado la cuenta bancaria de este prestador.
            </p>
            {puedeValidarCuenta ? (
              <CuentaBancariaActions
                prestadorId={prestador.id}
                cuentaId={null}
                estatus={null}
                titularInicial={`${prestador.nombre} ${prestador.apellidos}`}
              />
            ) : null}
          </div>
        )}
      </section>

      <section className="mb-6">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Documentos
          </h2>
          {pendientes > 0 ? (
            <Badge variant="warning">{pendientes} por revisar</Badge>
          ) : null}
        </div>
        {docs.length === 0 ? (
          <EmptyState
            title="Sin documentos"
            description="Este prestador todavía no ha subido documentos. Pídelos por el canal habitual."
          />
        ) : (
          <ul className="space-y-2">
            {docs.map((d) => (
              <DocumentRow
                key={d.id}
                doc={d}
                canReview={puedeRevisarDocs}
                aprobar={aprobarDocumento}
                rechazar={rechazarDocumento}
              />
            ))}
          </ul>
        )}
      </section>

      {puedeRestringir ? (
        <RestrictControls
          tone={prestador.restringido ? 'unrestrict' : 'restrict'}
          targetId={prestador.id}
          restringir={restringirPrestador}
          quitar={quitarRestriccionPrestador}
        />
      ) : null}

      <p className="mt-2 text-xs text-muted-foreground">
        Última actividad: {formatFechaCorta(prestador.created_at)}
      </p>
    </>
  );
}
