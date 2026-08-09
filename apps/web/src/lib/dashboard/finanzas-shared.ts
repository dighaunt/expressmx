export type MetodoPago = 'tarjeta' | 'efectivo' | 'transferencia';
export type EstatusPago = 'pendiente' | 'procesado' | 'fallido' | 'reembolsado';
export type EstatusCorte = 'generado' | 'revisado' | 'depositado';
export type EstatusFactura = 'timbrada' | 'cancelada';
export type EstatusDeposito = 'pendiente' | 'depositado';

export const METODO_PAGO_LABEL: Record<MetodoPago, string> = {
  tarjeta: 'Tarjeta',
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
};

export const ESTATUS_PAGO_LABEL: Record<EstatusPago, string> = {
  pendiente: 'Pendiente',
  procesado: 'Procesado',
  fallido: 'Fallido',
  reembolsado: 'Reembolsado',
};

export const ESTATUS_CORTE_LABEL: Record<EstatusCorte, string> = {
  generado: 'Generado',
  revisado: 'Revisado',
  depositado: 'Depositado',
};

export const ESTATUS_FACTURA_LABEL: Record<EstatusFactura, string> = {
  timbrada: 'Timbrada',
  cancelada: 'Cancelada',
};
