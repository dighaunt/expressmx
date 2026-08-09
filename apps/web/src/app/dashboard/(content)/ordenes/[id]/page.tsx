import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowSquareOut,
  Calendar,
  Camera,
  CreditCard,
  CurrencyCircleDollar,
  EnvelopeSimple,
  Ghost,
  Lock,
  MapPin,
  Phone,
  Receipt,
  TicketIcon,
  User,
  UserCircle,
  Wallet,
  Warning,
} from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { EstatusBadge } from '@/components/dashboard/estatus-badge';
import { PageHeader } from '@/components/dashboard/page-header';
import { requirePermiso } from '@/lib/dashboard/auth-gate';
import { tienePermiso } from '@/lib/dashboard/rbac';
import { formatFechaHora, formatFechaLarga, formatMoneda } from '@/lib/dashboard/format';
import { getOrdenDetalle } from '@/lib/dashboard/queries/ordenes';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Orden · ExpressMX' };

const ESTATUS_PAGO_VARIANT: Record<string, 'success' | 'warning' | 'destructive' | 'info'> = {
  procesado: 'success',
  pendiente: 'warning',
  fallido: 'destructive',
  reembolsado: 'info',
};

const ESTATUS_REEMBOLSO_VARIANT: Record<string, 'success' | 'warning' | 'destructive' | 'info'> = {
  procesado: 'success',
  solicitado: 'warning',
  aprobado: 'info',
  rechazado: 'destructive',
};

const TIER_LABEL: Record<string, string> = { l1: 'L1', l2: 'L2', l3: 'L3' };

export default async function OrdenDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requirePermiso('ordenes.ver');
  const { id } = await params;
  const detalle = await getOrdenDetalle(id);
  if (!detalle) notFound();

  const { header, pagos, reembolsos, tickets, evidencias, webhook_events } = detalle;
  const puedeAbrirTicket = tienePermiso(viewer, 'soporte.abrir_caso');
  const puedeVerFinanzas = tienePermiso(viewer, 'finanzas.ver');

  const totalPagado = pagos
    .filter((p) => p.estatus === 'procesado')
    .reduce((acc, p) => acc + Number(p.monto), 0);
  const totalOrden = Number(header.monto_total);
  const sinReconciliar = pagos.some(
    (p) => p.estatus === 'pendiente' && p.payment_intent_id && !p.webhook_received_at,
  );

  const evidenciasAntes = evidencias.filter((e) => e.fase === 'antes').length;
  const evidenciasDespues = evidencias.filter((e) => e.fase === 'despues').length;

  return (
    <>
      <nav className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/dashboard/ordenes" className="hover:text-foreground hover:underline">
          Órdenes
        </Link>
        <span aria-hidden>/</span>
        <span className="font-mono">#{header.id.slice(0, 8).toUpperCase()}</span>
      </nav>
      <PageHeader
        title={`Orden #${header.id.slice(0, 8).toUpperCase()}`}
        description={`${header.servicio_nombre} · ${formatFechaLarga(header.fecha_programada)}`}
        actions={
          <div className="flex items-center gap-2">
            <EstatusBadge estatus={header.estatus} />
            <span className="text-base font-semibold tabular-nums">
              {formatMoneda(header.monto_total, true)}
            </span>
          </div>
        }
      />

      {sinReconciliar ? (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
          <Warning size={16} aria-hidden className="mt-0.5 text-warning-foreground" />
          <div className="flex-1">
            <p className="font-semibold text-warning-foreground">
              Pago sin reconciliar contra Stripe
            </p>
            <p className="text-xs text-muted-foreground">
              Esta orden tiene al menos un pago en estado <code>pendiente</code> sin
              webhook recibido. El cron <code>cron:pagos-reconciliar</code> intentará
              cerrarlo o el agente de soporte puede crear una tarea de investigación
              desde el ticket.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Section title="Pagos" count={pagos.length} icon={CreditCard}>
            {pagos.length === 0 ? (
              <Empty message="Aún no se ha generado ningún PaymentIntent para esta orden." />
            ) : (
              <ul className="divide-y divide-border">
                {pagos.map((p) => (
                  <li key={p.id} className="space-y-1.5 px-3 py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={ESTATUS_PAGO_VARIANT[p.estatus] ?? 'info'}>
                            {p.estatus}
                          </Badge>
                          <span className="text-xs uppercase tracking-wide text-muted-foreground">
                            {p.metodo}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatFechaHora(p.created_at)}
                          </span>
                        </div>
                        {p.payment_intent_id ? (
                          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                            {p.payment_intent_id}
                          </p>
                        ) : null}
                        <p className="text-[11px] text-muted-foreground">
                          {p.webhook_received_at
                            ? `Webhook ${formatFechaHora(p.webhook_received_at)}`
                            : 'Sin webhook recibido'}
                          {p.raw_status ? ` · raw=${p.raw_status}` : ''}
                          {p.referencia_pasarela ? ` · ${p.referencia_pasarela}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-semibold tabular-nums">
                          {formatMoneda(p.monto, true)}
                        </span>
                        {puedeVerFinanzas ? (
                          <Link
                            href={`/dashboard/pagos/${p.id}`}
                            className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:underline"
                          >
                            Ver pago <ArrowSquareOut size={10} aria-hidden />
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {pagos.length > 0 ? (
              <div className="border-t border-border bg-muted/40 px-3 py-2 text-xs">
                <span className="text-muted-foreground">Pagado procesado:</span>{' '}
                <span className="font-semibold tabular-nums">
                  {formatMoneda(totalPagado.toFixed(2), true)}
                </span>
                {totalPagado < totalOrden ? (
                  <span className="ml-2 text-warning-foreground">
                    · faltan{' '}
                    {formatMoneda((totalOrden - totalPagado).toFixed(2), true)}
                  </span>
                ) : null}
              </div>
            ) : null}
          </Section>

          {reembolsos.length > 0 ? (
            <Section title="Reembolsos" count={reembolsos.length} icon={CurrencyCircleDollar}>
              <ul className="divide-y divide-border">
                {reembolsos.map((r) => (
                  <li key={r.id} className="space-y-1 px-3 py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={ESTATUS_REEMBOLSO_VARIANT[r.estatus] ?? 'info'}>
                            {r.estatus}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatFechaHora(r.created_at)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm">{r.motivo}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-semibold tabular-nums">
                          {formatMoneda(r.monto, true)}
                        </span>
                        {puedeVerFinanzas ? (
                          <Link
                            href={`/dashboard/finanzas/reembolso/${r.id}`}
                            className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:underline"
                          >
                            Ver reembolso <ArrowSquareOut size={10} aria-hidden />
                          </Link>
                        ) : null}
                      </div>
                    </div>
                    {r.ticket_id ? (
                      <Link
                        href={`/dashboard/soporte/ticket/${r.ticket_id}`}
                        className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-primary hover:underline"
                      >
                        Ticket #{r.ticket_id.slice(0, 8)} <ArrowSquareOut size={10} aria-hidden />
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Section title="Tickets de soporte" count={tickets.length} icon={TicketIcon}>
            {tickets.length === 0 ? (
              <Empty message="Sin tickets vinculados a esta orden." />
            ) : (
              <ul className="divide-y divide-border">
                {tickets.map((t) => (
                  <li key={t.id} className="px-3 py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[10px]">
                            {t.tipo}
                          </span>
                          <span className="rounded-md border border-info/40 bg-info/10 px-1.5 py-0.5 text-[10px] text-info-foreground">
                            {t.categoria}
                          </span>
                          <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px]">
                            {TIER_LABEL[t.tier_actual] ?? t.tier_actual}
                          </span>
                          <span className="rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[10px]">
                            {t.estatus}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatFechaHora(t.created_at)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-medium">{t.asunto}</p>
                      </div>
                      <Link
                        href={`/dashboard/soporte/ticket/${t.id}`}
                        className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:underline"
                      >
                        Abrir <ArrowSquareOut size={10} aria-hidden />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Evidencias fotográficas"
            count={evidencias.length}
            icon={Camera}
          >
            {evidencias.length === 0 ? (
              <Empty message="El prestador aún no ha subido fotos antes/después." />
            ) : (
              <div className="grid gap-3 px-3 py-2 sm:grid-cols-2">
                <FaseCard label="Antes" total={evidenciasAntes} />
                <FaseCard label="Después" total={evidenciasDespues} />
              </div>
            )}
          </Section>

          <Section title="Eventos de pasarela" count={webhook_events.length} icon={Receipt}>
            {webhook_events.length === 0 ? (
              <Empty message="No se han recibido webhooks de Stripe para los pagos de esta orden." />
            ) : (
              <ul className="divide-y divide-border">
                {webhook_events.map((w) => (
                  <li
                    key={w.external_id}
                    className="flex items-start justify-between gap-3 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px]">{w.event_type}</span>
                        {w.error ? (
                          <Badge variant="destructive">error</Badge>
                        ) : w.processed_at ? (
                          <Badge variant="success">processed</Badge>
                        ) : (
                          <Badge variant="warning">pending</Badge>
                        )}
                        {w.retry_count > 0 ? (
                          <span className="text-[10px] text-muted-foreground">
                            retries: {w.retry_count}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                        {w.external_id}
                      </p>
                      {w.error ? (
                        <p className="mt-1 text-[11px] text-destructive">{w.error}</p>
                      ) : null}
                    </div>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {formatFechaHora(w.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <aside className="space-y-4">
          <Section title="Cliente" icon={UserCircle}>
            <div className="space-y-2 px-3 py-2 text-sm">
              <p className="font-medium">{header.cliente_nombre}</p>
              <Field icon={EnvelopeSimple} value={header.cliente_email} />
              {header.cliente_telefono ? (
                <Field icon={Phone} value={header.cliente_telefono} />
              ) : null}
              {puedeAbrirTicket ? (
                <Link
                  href={`/dashboard/clientes/${header.cliente_id}`}
                  className="mt-1 inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
                >
                  Customer 360 <ArrowSquareOut size={10} aria-hidden />
                </Link>
              ) : null}
            </div>
          </Section>

          <Section title="Prestador" icon={User}>
            <div className="space-y-2 px-3 py-2 text-sm">
              {header.prestador_nombre ? (
                <>
                  <p className="font-medium">{header.prestador_nombre}</p>
                  {header.prestador_telefono ? (
                    <Field icon={Phone} value={header.prestador_telefono} />
                  ) : null}
                </>
              ) : (
                <p className="text-muted-foreground italic">Sin asignar</p>
              )}
            </div>
          </Section>

          <Section title="Servicio" icon={Wallet}>
            <div className="space-y-2 px-3 py-2 text-sm">
              <p className="font-medium">{header.servicio_nombre}</p>
              {header.servicio_categoria ? (
                <p className="text-xs text-muted-foreground">
                  Categoría: {header.servicio_categoria}
                </p>
              ) : null}
              <Field
                icon={Calendar}
                value={`Programado: ${formatFechaLarga(header.fecha_programada)}`}
              />
              <Field icon={MapPin} value={header.direccion_completa} />
              {header.direccion_referencia ? (
                <p className="text-xs text-muted-foreground">
                  Referencia: {header.direccion_referencia}
                </p>
              ) : null}
            </div>
          </Section>

          {header.pin_cliente || header.pin_prestador ? (
            <Section title="PINs" icon={Lock}>
              <div className="space-y-1 px-3 py-2 text-sm">
                {header.pin_cliente ? (
                  <p>
                    <span className="text-muted-foreground">Cliente:</span>{' '}
                    <span className="font-mono">{header.pin_cliente}</span>
                  </p>
                ) : null}
                {header.pin_prestador ? (
                  <p>
                    <span className="text-muted-foreground">Prestador:</span>{' '}
                    <span className="font-mono">{header.pin_prestador}</span>
                  </p>
                ) : null}
              </div>
            </Section>
          ) : null}

          {header.notas_cliente ? (
            <Section title="Notas del cliente" icon={Ghost}>
              <p className="whitespace-pre-wrap px-3 py-2 text-xs text-muted-foreground">
                {header.notas_cliente}
              </p>
            </Section>
          ) : null}
        </aside>
      </div>
    </>
  );
}

function Section({
  title,
  count,
  icon: Icon,
  children,
}: {
  title: string;
  count?: number;
  icon: React.ComponentType<{ size?: number; weight?: 'regular' | 'fill' | 'duotone'; 'aria-hidden'?: boolean }>;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-2">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Icon size={12} aria-hidden />
          {title}
        </h2>
        {typeof count === 'number' ? (
          <span className="text-xs text-muted-foreground">{count}</span>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <p className="px-3 py-4 text-center text-xs italic text-muted-foreground">
      {message}
    </p>
  );
}

function Field({
  icon: Icon,
  value,
}: {
  icon: React.ComponentType<{ size?: number; weight?: 'regular' | 'fill' | 'duotone'; 'aria-hidden'?: boolean }>;
  value: string;
}) {
  return (
    <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
      <Icon size={12} aria-hidden weight="duotone" />
      <span className="break-words">{value}</span>
    </div>
  );
}

function FaseCard({ label, total }: { label: string; total: number }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{total}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {total === 0 ? 'Sin fotos' : total === 1 ? '1 foto subida' : `${total} fotos`}
      </p>
    </div>
  );
}
