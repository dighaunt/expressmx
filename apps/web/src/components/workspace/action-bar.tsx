import { ActionTaskCreate } from './action-task-create';
import { ActionRefundDialog } from './action-refund-dialog';
import { ActionInvestigatePaymentDialog } from './action-investigate-payment-dialog';
import { ActionCreditDialog } from './action-credit-dialog';
import { ActionSuspendDialog } from './action-suspend-dialog';
import { ActionReassignDialog } from './action-reassign-dialog';
import { ActionCfdiDialog } from './action-cfdi-dialog';
import { ActionReactivateButton } from './action-reactivate-button';
import { ActionReminderCreate } from './action-reminder-create';

interface PagoOption {
  id: string;
  monto: string;
  metodo: string;
  estatus: string;
  orden_id: string;
}

interface FacturaOption {
  id: string;
  uuid_cfdi: string | null;
  estatus: string;
  total: string;
  created_at?: string | null;
}

interface OrdenOption {
  id: string;
  estatus: string;
  servicio_nombre: string;
}

interface Props {
  ticketId: string;
  clienteId: string;
  categoria: string;
  ticketCerrado: boolean;
  clienteSuspendido: boolean;
  suspensionId?: string | null | undefined;
  pagos: PagoOption[];
  facturas: FacturaOption[];
  ordenes: OrdenOption[];
  permisos: {
    crearTarea: boolean;
    solicitarReembolso: boolean;
    aprobarReembolsoExpress: boolean;
    investigarPago: boolean;
    aplicarCredito: boolean;
    aplicarCreditoSinAprobacion: boolean;
    suspenderCuenta: boolean;
    reactivarCuenta: boolean;
    reasignarPrestador: boolean;
    cancelarCfdi: boolean;
    programarRecordatorio: boolean;
  };
  umbrales: {
    reembolso_express_max_mxn: number;
    credito_express_max_mxn: number;
    suspension_express_max_dias: number;
  };
  capCredito?: {
    capServicioMxn: number | null;
    factorServicio: number | null;
  };
}

const HORAS_72_MS = 72 * 60 * 60 * 1000;

function facturasCfdiElegibles(facturas: FacturaOption[]): FacturaOption[] {
  const ahora = Date.now();
  return facturas.filter((f) => {
    if (f.estatus === 'cancelada') return true;
    if (f.estatus !== 'timbrada') return false;
    if (!f.created_at) return true;
    const ts = new Date(f.created_at).getTime();
    if (Number.isNaN(ts)) return true;
    return ahora - ts <= HORAS_72_MS;
  });
}

const ESTATUS_ORDEN_REASIGNABLES = new Set(['solicitada', 'asignada']);

export function ActionBar({
  ticketId,
  clienteId,
  ticketCerrado,
  clienteSuspendido,
  suspensionId,
  pagos,
  facturas,
  ordenes,
  permisos,
  umbrales,
  capCredito,
}: Props) {
  if (ticketCerrado) {
    return (
      <p className="rounded-md border border-dashed border-border bg-background p-3 text-xs text-muted-foreground">
        Este ticket está cerrado. Para tomar acciones, reabre o crea uno nuevo.
      </p>
    );
  }

  const facturasElegibles = facturasCfdiElegibles(facturas);
  const ordenesElegibles = ordenes.filter((o) => ESTATUS_ORDEN_REASIGNABLES.has(o.estatus));

  const hayPagoPendiente = pagos.some(
    (p) => p.estatus === 'pendiente' || p.estatus === 'fallido',
  );
  const mostrarInvestigarPago = permisos.investigarPago && hayPagoPendiente;

  const hasAny =
    permisos.crearTarea ||
    permisos.solicitarReembolso ||
    mostrarInvestigarPago ||
    permisos.aplicarCredito ||
    permisos.suspenderCuenta ||
    (permisos.reactivarCuenta && clienteSuspendido && suspensionId) ||
    permisos.reasignarPrestador ||
    permisos.cancelarCfdi ||
    permisos.programarRecordatorio;

  if (!hasAny) {
    return (
      <p className="rounded-md border border-dashed border-border bg-background p-3 text-xs text-muted-foreground">
        Tu rol no tiene acciones de remediación habilitadas.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {mostrarInvestigarPago ? (
        <ActionInvestigatePaymentDialog ticketId={ticketId} pagos={pagos} />
      ) : null}

      {permisos.solicitarReembolso && pagos.some((p) => p.estatus === 'procesado') ? (
        <ActionRefundDialog
          ticketId={ticketId}
          pagos={pagos}
          umbralExpressMxn={umbrales.reembolso_express_max_mxn}
          puedeAprobarExpress={permisos.aprobarReembolsoExpress}
        />
      ) : null}

      {permisos.aplicarCredito && !clienteSuspendido ? (
        <ActionCreditDialog
          ticketId={ticketId}
          clienteId={clienteId}
          umbralExpressMxn={umbrales.credito_express_max_mxn}
          puedeSinAprobacion={permisos.aplicarCreditoSinAprobacion}
          capServicioMxn={capCredito?.capServicioMxn ?? null}
          factorServicio={capCredito?.factorServicio ?? null}
        />
      ) : null}

      {permisos.reasignarPrestador && ordenesElegibles.length > 0 ? (
        <ActionReassignDialog ticketId={ticketId} ordenes={ordenesElegibles} />
      ) : null}

      {permisos.cancelarCfdi && facturasElegibles.length > 0 ? (
        <ActionCfdiDialog ticketId={ticketId} facturas={facturasElegibles} />
      ) : null}

      {permisos.suspenderCuenta && !clienteSuspendido ? (
        <ActionSuspendDialog
          ticketId={ticketId}
          usuarioId={clienteId}
          maxExpressDias={umbrales.suspension_express_max_dias}
        />
      ) : null}

      {permisos.reactivarCuenta && clienteSuspendido && suspensionId ? (
        <ActionReactivateButton suspensionId={suspensionId} />
      ) : null}

      {permisos.crearTarea ? <ActionTaskCreate ticketId={ticketId} /> : null}

      {permisos.programarRecordatorio ? (
        <ActionReminderCreate ticketId={ticketId} />
      ) : null}
    </div>
  );
}
