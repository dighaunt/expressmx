import type { Metadata } from 'next';
import Link from 'next/link';
import { ListChecks } from '@phosphor-icons/react/ssr';
import { TareaCompletarForm } from '@/components/dashboard/tarea-completar-form';
import { TareaInvestigacionPagoForm } from '@/components/dashboard/tarea-investigacion-pago-form';
import { ContextSidebar, WorkspaceShell } from '@/components/workspace';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';
import { listarTareasPorGrupo } from '@/lib/dashboard/queries/tareas';
import { formatFechaHora } from '@/lib/dashboard/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Tareas de soporte · Finanzas · ExpressMX',
};

const TIPO_LABEL = {
  reembolso: 'Procesar reembolso',
  cfdi_cancelacion: 'Cancelar CFDI',
  cfdi_reemision: 'Reemitir CFDI',
  credito_aplicacion: 'Aplicar crédito',
  reasignar_prestador: 'Reasignar prestador',
  investigacion_pago: 'Investigar pago',
  callback_cliente: 'Callback cliente',
  verificacion_id: 'Verificar identidad',
  follow_up_interno: 'Seguimiento interno',
} as const;

export default async function FinanzasTareasBandejaPage() {
  const viewer = await requirePermiso('finanzas.ver');
  const puedeCompletar = tienePermiso(viewer, 'soporte.tarea.completar');

  const grupos = tienePermiso(viewer, 'roles.gestionar')
    ? ['finanzas_l1', 'finanzas_l2', 'super_admin']
    : ['finanzas_l1', 'finanzas_l2'];
  const tareas = await listarTareasPorGrupo(grupos, { limit: 100, soloActivas: true });

  return (
    <WorkspaceShell
      queue={
        <nav className="flex flex-col gap-1 p-3 text-sm">
          <Link
            href="/dashboard/finanzas"
            className="rounded-md px-2 py-1.5 hover:bg-muted/40"
          >
            Reembolsos / Cortes / Facturas
          </Link>
          <Link
            href="/dashboard/finanzas/aprobaciones-pendientes"
            className="rounded-md px-2 py-1.5 hover:bg-muted/40"
          >
            Aprobaciones pendientes
          </Link>
          <Link
            href="/dashboard/finanzas/tareas-bandeja"
            className="rounded-md bg-muted/60 px-2 py-1.5 font-medium"
          >
            Bandeja de tareas ({tareas.length})
          </Link>
        </nav>
      }
      header={
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Finanzas
            </p>
            <h1 className="text-base font-semibold">Tareas desde soporte</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            {tareas.length} tarea(s) abierta(s)
          </p>
        </div>
      }
      main={
        tareas.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-background p-8 text-center">
            <ListChecks
              size={32}
              weight="duotone"
              aria-hidden
              className="mx-auto mb-2 text-muted-foreground"
            />
            <p className="text-sm font-medium">Sin tareas pendientes</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Cuando soporte solicite reembolsos express, créditos aprobados o
              cancelaciones de CFDI, aparecerán aquí.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {tareas.map((t) => (
              <li
                key={t.id}
                className="rounded-md border border-border bg-background p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="rounded-md border border-info/40 bg-info/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-info-foreground">
                        {TIPO_LABEL[t.tipo]}
                      </span>
                      <span className="rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[10px]">
                        {t.estado}
                      </span>
                      {t.bloqueante ? (
                        <span className="rounded-md border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">
                          Bloqueante
                        </span>
                      ) : null}
                      <span className="text-[10px] text-muted-foreground">
                        {formatFechaHora(t.created_at)} · por {t.creado_por_nombre}
                      </span>
                    </div>
                    <p className="text-sm font-medium">{t.asunto}</p>
                    {t.descripcion_md ? (
                      <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                        {t.descripcion_md}
                      </p>
                    ) : null}
                    {Object.keys(t.payload).length > 0 ? (
                      <pre className="overflow-x-auto rounded-md border border-border bg-muted/20 p-2 text-[10px]">
                        {JSON.stringify(t.payload, null, 2)}
                      </pre>
                    ) : null}
                    <p className="text-[10px]">
                      <Link
                        href={`/dashboard/soporte/ticket/${t.ticket_id}`}
                        className="text-primary underline"
                      >
                        Ver ticket #{t.ticket_id.slice(0, 8)}
                      </Link>
                    </p>
                  </div>
                  {puedeCompletar ? (
                    t.tipo === 'investigacion_pago' ? (
                      <TareaInvestigacionPagoForm
                        tareaId={t.id}
                        estado={t.estado}
                      />
                    ) : (
                      <TareaCompletarForm
                        tareaId={t.id}
                        tipo={t.tipo}
                        estado={t.estado}
                        payloadSubtipo={
                          typeof t.payload['subtipo'] === 'string'
                            ? (t.payload['subtipo'] as string)
                            : null
                        }
                      />
                    )
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )
      }
      context={
        <ContextSidebar
          sections={[
            {
              key: 'leyenda',
              title: 'Tipos de tarea',
              children: (
                <ul className="space-y-1 text-[11px] text-muted-foreground">
                  <li>
                    <strong>Reembolso:</strong> aprobado por soporte (express o post-aprobación), aquí solo procesar la transferencia y registrar referencia.
                  </li>
                  <li>
                    <strong>Cancelar/Reemitir CFDI:</strong> usar Facturama para cancelar ante el SAT y subir acuse.
                  </li>
                  <li>
                    <strong>Aplicar crédito:</strong> ya aprobado, falta insertar el movimiento positivo en saldo.
                  </li>
                  <li>
                    <strong>Investigar pago:</strong> revisar logs de pasarela y reportar al ticket.
                  </li>
                </ul>
              ),
            },
          ]}
        />
      }
    />
  );
}
