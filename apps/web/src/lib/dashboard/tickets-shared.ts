export type CategoriaTicket =
  | 'cobro_incorrecto'
  | 'no_show'
  | 'dano_propiedad'
  | 'queja_servicio'
  | 'otro';

export type PrioridadTicket = 'baja' | 'media' | 'alta' | 'critica';
export type EstatusTicket = 'abierto' | 'en_revision' | 'resuelto' | 'escalado';
export type TipoAutorMsg = 'usuario' | 'agente' | 'sistema';

export const CATEGORIA_LABEL: Record<CategoriaTicket, string> = {
  cobro_incorrecto: 'Cobro incorrecto',
  no_show: 'Cliente / prestador no se presentó',
  dano_propiedad: 'Daño a la propiedad',
  queja_servicio: 'Queja de servicio',
  otro: 'Otro',
};

export const PRIORIDAD_LABEL: Record<PrioridadTicket, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  critica: 'Crítica',
};

export const ESTATUS_LABEL: Record<EstatusTicket, string> = {
  abierto: 'Abierto',
  en_revision: 'En revisión',
  resuelto: 'Resuelto',
  escalado: 'Escalado',
};

export type TipoTicket = 'incidente' | 'solicitud' | 'problema' | 'cambio';

export type TierSoporte = 'l1' | 'l2' | 'l3';

export type EstatusTicketV2 =
  | 'nuevo'
  | 'en_progreso'
  | 'en_espera_cliente'
  | 'en_espera_tercero'
  | 'resuelto'
  | 'cerrado'
  | 'cancelado'
  | 'investigacion'
  | 'error_conocido'
  | 'fix_en_progreso';

export type CodigoResolucion =
  | 'resuelto_directo'
  | 'kb_resuelto'
  | 'reembolso_emitido'
  | 'duplicado'
  | 'no_aplica'
  | 'no_reproducible'
  | 'sin_respuesta_cliente';

export type EscalationMotivo =
  | 'fuera_alcance'
  | 'requiere_autorizacion'
  | 'requiere_dev'
  | 'sla_breach'
  | 'cliente_solicitud';

export const TIPO_TICKET_LABEL: Record<TipoTicket, string> = {
  incidente: 'Incidente',
  solicitud: 'Solicitud',
  problema: 'Problema',
  cambio: 'Cambio',
};

export const TIER_LABEL: Record<TierSoporte, string> = {
  l1: 'Nivel 1',
  l2: 'Nivel 2',
  l3: 'Nivel 3',
};

export const ESTATUS_V2_LABEL: Record<EstatusTicketV2, string> = {
  nuevo: 'Nuevo',
  en_progreso: 'En progreso',
  en_espera_cliente: 'Esperando al cliente',
  en_espera_tercero: 'Esperando a tercero',
  resuelto: 'Resuelto',
  cerrado: 'Cerrado',
  cancelado: 'Cancelado',
  investigacion: 'Investigación',
  error_conocido: 'Error conocido',
  fix_en_progreso: 'Fix en progreso',
};

export const CODIGO_RESOLUCION_LABEL: Record<CodigoResolucion, string> = {
  resuelto_directo: 'Resuelto en primer contacto',
  kb_resuelto: 'Resuelto con KB',
  reembolso_emitido: 'Reembolso emitido',
  duplicado: 'Duplicado',
  no_aplica: 'No aplica',
  no_reproducible: 'No reproducible',
  sin_respuesta_cliente: 'Sin respuesta del cliente',
};

export const ESCALATION_MOTIVO_LABEL: Record<EscalationMotivo, string> = {
  fuera_alcance: 'Fuera de alcance del tier',
  requiere_autorizacion: 'Requiere autorización superior',
  requiere_dev: 'Requiere intervención de desarrollo',
  sla_breach: 'SLA por incumplir',
  cliente_solicitud: 'Solicitud explícita del cliente',
};
