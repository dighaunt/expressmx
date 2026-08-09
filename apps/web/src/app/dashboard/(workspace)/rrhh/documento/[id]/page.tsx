import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowSquareOut,
  Envelope,
  Image as ImageIcon,
  Phone,
  ShieldWarning,
} from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { DocumentoActions } from '@/components/dashboard/documento-actions';
import { RRHHQueue } from '@/components/dashboard/rrhh-queue';
import {
  ContextSidebar,
  ItemForm,
  WorkspaceBreadcrumbs,
  WorkspaceShell,
} from '@/components/workspace';
import { ForbiddenError } from '@/lib/errors/http-errors';
import { requireViewer } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';
import { formatFechaHora, formatFechaLarga } from '@/lib/dashboard/format';
import {
  ESTATUS_DOC_LABEL,
  TIPO_DOC_LABEL,
  getDocumentoDetalle,
  type EstatusDocumento,
} from '@/lib/dashboard/queries/rrhh-workspace';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Documento · RRHH · ExpressMX' };

const ESTATUS_VARIANT: Record<EstatusDocumento, 'success' | 'warning' | 'destructive'> = {
  aprobado: 'success',
  pendiente: 'warning',
  rechazado: 'destructive',
};

export default async function DocumentoWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireViewer();
  if (!tienePermiso(viewer, 'prestadores.revisar_docs')) {
    throw new ForbiddenError('Necesitas permiso prestadores.revisar_docs');
  }
  const { id } = await params;
  const doc = await getDocumentoDetalle(id);
  if (!doc) notFound();

  return (
    <WorkspaceShell
      accent="rrhh"
      header={
        <div className="min-w-0">
          <WorkspaceBreadcrumbs
            items={[
              { label: 'RRHH', href: '/dashboard/rrhh' },
              { label: 'Documentos', href: '/dashboard/rrhh' },
              { label: `${TIPO_DOC_LABEL[doc.tipo]} · ${doc.prestador_nombre}` },
            ]}
          />
          <h1 className="mt-1 text-base font-semibold truncate">
            {TIPO_DOC_LABEL[doc.tipo]} · {doc.prestador_nombre}
          </h1>
        </div>
      }
      queue={
        <RRHHQueue
          viewerId={viewer.userId}
          active={{ kind: 'documento', id: doc.id }}
          bucket="docs_pendientes"
        />
      }
      main={
        <ItemForm
          title={`${TIPO_DOC_LABEL[doc.tipo]} de ${doc.prestador_nombre}`}
          subtitle={`#${doc.id.slice(0, 8)} · subido ${formatFechaHora(doc.created_at)}`}
          badges={
            <Badge variant={ESTATUS_VARIANT[doc.estatus]}>
              {ESTATUS_DOC_LABEL[doc.estatus]}
            </Badge>
          }
          fields={
            <div className="space-y-4 text-sm">
              <Section icon={ImageIcon} title="Archivo">
                {doc.archivo_url ? (
                  doc.archivo_url.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i) ? (
                    <a
                      href={doc.archivo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block overflow-hidden rounded-lg border border-border bg-muted/40"
                    >
                      <img
                        src={doc.archivo_url}
                        alt={`Documento ${TIPO_DOC_LABEL[doc.tipo]}`}
                        className="max-h-[400px] w-full object-contain"
                      />
                    </a>
                  ) : (
                    <a
                      href={doc.archivo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
                    >
                      Abrir archivo <ArrowSquareOut size={12} aria-hidden />
                    </a>
                  )
                ) : (
                  <p className="text-xs text-muted-foreground">Sin archivo cargado.</p>
                )}
              </Section>

              {doc.fecha_expiracion ? (
                <Section title="Fecha de expiración del documento">
                  <p>{formatFechaLarga(doc.fecha_expiracion)}</p>
                </Section>
              ) : null}
            </div>
          }
          activity={
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Acciones
              </h3>
              <DocumentoActions documentoId={doc.id} estatus={doc.estatus} />
            </div>
          }
        />
      }
      context={
        <ContextSidebar
          sections={[
            {
              key: 'prestador',
              title: 'Prestador',
              children: (
                <div className="space-y-2">
                  <Link
                    href={`/dashboard/prestadores/${doc.prestador_id}`}
                    className="block font-medium text-sm hover:underline"
                  >
                    {doc.prestador_nombre}
                  </Link>
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Envelope size={12} aria-hidden /> {doc.prestador_email}
                  </p>
                  {doc.prestador_telefono ? (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone size={12} aria-hidden /> {doc.prestador_telefono}
                    </p>
                  ) : null}
                </div>
              ),
            },
            {
              key: 'estado',
              title: 'Estado del prestador',
              children: (
                <div className="space-y-2 text-xs">
                  {doc.prestador_restringido ? (
                    <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-destructive">
                      <ShieldWarning size={14} aria-hidden className="mt-0.5 shrink-0" />
                      <span>Cuenta restringida. Aprobar el doc no la libera automáticamente.</span>
                    </div>
                  ) : null}
                  <p className="text-muted-foreground">
                    Otros documentos aprobados:{' '}
                    <strong className="text-foreground">{doc.otros_docs_aprobados}</strong>
                  </p>
                  <p className="text-muted-foreground">
                    Recibe órdenes:{' '}
                    <strong className="text-foreground">
                      {doc.prestador_recibe_ordenes ? 'Sí' : 'No'}
                    </strong>
                  </p>
                </div>
              ),
            },
            {
              key: 'tip',
              title: 'Recomendación',
              children: (
                <p className="text-xs text-muted-foreground">
                  Antes de aprobar, valida que el nombre del documento coincida con el
                  registrado en el perfil. Si hay discrepancias, rechaza con motivo claro
                  para que el prestador suba uno corregido.
                </p>
              ),
            },
          ]}
        />
      }
    />
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon?: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {Icon ? <Icon size={12} aria-hidden /> : null}
        {title}
      </h3>
      <div>{children}</div>
    </div>
  );
}
