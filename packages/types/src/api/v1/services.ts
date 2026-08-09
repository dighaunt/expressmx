import type { MobileServicesQuery } from '@expressmx/validations';
import type { DataResponse } from './common';

export type ServicesListQuery = MobileServicesQuery;

export interface ServiceSummary {
  id: string;
  nombre: string;
  descripcion: string;
  precio_base: number;
  precio_maximo: number;
  duracion_estimada_min: number;
  categoria: string;
  prestadores_count: number;
  calificacion_promedio: number;
}

export interface ServicesListResponse {
  servicios: ServiceSummary[];
}

export interface ServiceDetail extends ServiceSummary {}

export interface ServiceDetailResponse {
  servicio: ServiceDetail;
}

export type ServiceDetailUnifiedResponse = DataResponse<ServiceDetail>;
