export type RolUsuario = 'cliente' | 'prestador' | 'admin';
export type TipoDocumento = 'ine' | 'domicilio' | 'certificacion' | 'curp';
export type EstatusDocumento = 'pendiente' | 'aprobado' | 'rechazado';
export type DiaSemana = 'lun' | 'mar' | 'mie' | 'jue' | 'vie' | 'sab' | 'dom';
export type EstatusOrden =
  | 'solicitada'
  | 'asignada'
  | 'en_camino'
  | 'en_progreso'
  | 'completada'
  | 'cancelada';
export type MetodoPago = 'tarjeta' | 'efectivo' | 'transferencia';
export type EstatusPago = 'pendiente' | 'procesado' | 'fallido' | 'reembolsado';
export type EstatusDeposito = 'pendiente' | 'depositado';
export type TipoDescuento = 'porcentaje' | 'monto_fijo';
export type TipoNotif = 'push' | 'sms' | 'email';
export type CanalNotif = 'orden' | 'promo' | 'sistema';
export type EstatusZona = 'activa' | 'en_expansion' | 'suspendida';
export type TipoAjuste = 'multiplicador' | 'monto_fijo';
export type CatTicket =
  | 'cobro_incorrecto'
  | 'no_show'
  | 'dano_propiedad'
  | 'queja_servicio'
  | 'otro';
export type PrioridadTicket = 'baja' | 'media' | 'alta' | 'critica';
export type EstatusTicket = 'abierto' | 'en_revision' | 'resuelto' | 'escalado';
export type TipoAutorMsg = 'usuario' | 'agente' | 'sistema';
export type EstatusFactura = 'timbrada' | 'cancelada';
export type EstatusReembolso = 'solicitado' | 'aprobado' | 'rechazado' | 'procesado';
export type SegmentoBanner = 'todos' | 'nuevos' | 'recurrentes';
export type EstatusCorte = 'generado' | 'revisado' | 'depositado';
export type EstatusCargoExtra = 'propuesto' | 'aceptado' | 'rechazado';

export interface Usuario {
  id: string;
  nombre: string;
  apellidos: string;
  email: string;
  telefono: string | null;
  rol: RolUsuario;
  avatar_url: string | null;
  curp: string | null;
  fecha_nacimiento: string | null;
  activo: boolean;
  recibe_ordenes: boolean;
  motivo_restriccion: string | null;
  restringido_en: string | null;
  agencia_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoriaServicio {
  id: string;
  nombre: string;
  descripcion: string | null;
  icono_url: string | null;
  orden_despliegue: number;
  activa: boolean;
}

export interface Servicio {
  id: string;
  categoria_id: string;
  nombre: string;
  descripcion: string | null;
  precio_base: number;
  precio_maximo: number | null;
  duracion_estimada_min: number | null;
  activo: boolean;
}

export interface Direccion {
  id: string;
  usuario_id: string;
  alias: string | null;
  calle: string;
  numero_ext: string;
  numero_int: string | null;
  colonia: string;
  cp: string;
  ciudad: string;
  estado: string;
  latitud: number | null;
  longitud: number | null;
  referencia: string | null;
  predeterminada: boolean;
}

export interface OrdenServicio {
  id: string;
  cliente_id: string;
  prestador_id: string | null;
  servicio_id: string;
  direccion_id: string;
  cupon_id: string | null;
  estatus: EstatusOrden;
  fecha_programada: string;
  notas_cliente: string | null;
  notas_prestador: string | null;
  monto_total: number;
  descuento: number;
  created_at: string;
  updated_at: string;
}

export interface Pago {
  id: string;
  orden_id: string;
  monto: number;
  metodo: MetodoPago;
  estatus: EstatusPago;
  referencia_pasarela: string | null;
  created_at: string;
}

export interface Calificacion {
  id: string;
  orden_id: string;
  calificador_id: string;
  calificado_id: string;
  puntuacion: number;
  comentario: string | null;
  created_at: string;
}

export interface Notificacion {
  id: string;
  usuario_id: string;
  tipo: TipoNotif;
  titulo: string;
  cuerpo: string | null;
  canal: CanalNotif;
  leida: boolean;
  created_at: string;
}

export interface TicketSoporte {
  id: string;
  usuario_id: string;
  orden_id: string | null;
  agente_id: string | null;
  categoria: CatTicket;
  prioridad: PrioridadTicket;
  estatus: EstatusTicket;
  asunto: string;
  created_at: string;
  updated_at: string;
}

export interface Agencia {
  id: string;
  nombre: string;
  rfc: string | null;
  telefono: string | null;
  email: string | null;
  activa: boolean;
  created_at: string;
  updated_at: string;
}

export interface CrearOrdenDto {
  servicio_id: string;
  direccion_id: string;
  fecha_programada: string;
  notas_cliente?: string;
  cupon_id?: string;
}

export interface CrearDireccionDto {
  alias?: string;
  calle: string;
  numero_ext: string;
  numero_int?: string;
  colonia: string;
  cp: string;
  ciudad: string;
  estado: string;
  latitud?: number;
  longitud?: number;
  referencia?: string;
  predeterminada?: boolean;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterClienteDto {
  nombre: string;
  apellidos: string;
  email: string;
  password: string;
  telefono?: string;
}

export interface RegisterPrestadorDto extends RegisterClienteDto {
  codigo_invitacion: string;
  curp?: string;
  fecha_nacimiento?: string;
}

export * as ApiV1 from './api/v1';
