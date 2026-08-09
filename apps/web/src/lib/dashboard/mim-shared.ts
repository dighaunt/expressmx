export type EstadoMim =
  | 'declarado'
  | 'mitigando'
  | 'resuelto'
  | 'pir_pendiente'
  | 'cerrado';

export interface MajorIncidentSummary {
  id: string;
  titulo: string;
  estado: EstadoMim;
  declarado_at: string;
  mitigado_at: string | null;
  resuelto_at: string | null;
  servicios_afectados: ReadonlyArray<string>;
  tickets_vinculados: number;
}

export interface MajorIncidentDetalle {
  id: string;
  titulo: string;
  descripcion: string;
  estado: EstadoMim;
  declarado_por: string;
  declarado_por_nombre: string;
  declarado_at: string;
  mitigado_at: string | null;
  resuelto_at: string | null;
  pir_url: string | null;
  servicios_afectados: ReadonlyArray<string>;
  zonas_afectadas: ReadonlyArray<string>;
  tickets_vinculados: number;
  created_at: string;
  updated_at: string;
}

export interface MajorIncidentUpdate {
  id: string;
  contenido_md: string;
  estado_en_momento: EstadoMim;
  publicado_por_nombre: string;
  publicado_at: string;
}

export interface MajorIncidentTicketLink {
  ticket_id: string;
  asunto: string;
  estatus: string;
  vinculado_at: string;
  vinculado_por_nombre: string;
}

export const ESTADO_MIM_LABEL: Record<EstadoMim, string> = {
  declarado: 'Declarado',
  mitigando: 'Mitigando',
  resuelto: 'Resuelto',
  pir_pendiente: 'PIR pendiente',
  cerrado: 'Cerrado',
};

export const ESTADOS_MIM_ACTIVOS: ReadonlySet<EstadoMim> = new Set<EstadoMim>([
  'declarado',
  'mitigando',
  'pir_pendiente',
]);

export function esMimActivo(estado: EstadoMim): boolean {
  return ESTADOS_MIM_ACTIVOS.has(estado);
}

export function siguientesEstadosMim(actual: EstadoMim): ReadonlyArray<EstadoMim> {
  switch (actual) {
    case 'declarado':
      return ['mitigando', 'resuelto'];
    case 'mitigando':
      return ['resuelto'];
    case 'resuelto':
      return ['pir_pendiente', 'cerrado'];
    case 'pir_pendiente':
      return ['cerrado'];
    default:
      return [];
  }
}
