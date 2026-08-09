import type {
  MobileProviderJobsQuery,
  MobileProviderJobStatusInput,
} from '@expressmx/validations';
import type { EstatusOrden } from '../../index';
import type { DataResponse, PageResult } from './common';

export type ProviderJobsQuery = MobileProviderJobsQuery;

export interface ProviderJobListItem {
  id: string;
  estatus: EstatusOrden;
  created_at: string;
  servicio_nombre: string;
  cliente_nombre: string;
  direccion: string | null;
  fecha_programada: string | null;
  total: number;
}
export type ProviderJobsListResponse = PageResult<ProviderJobListItem>;

export interface ProviderJobDetail {
  id: string;
  estatus: EstatusOrden;
  servicio_nombre: string;
  cliente_nombre: string;
  cliente_telefono: string | null;
  direccion: string | null;
  fecha_programada: string | null;
  notas: string | null;
  total: number;
}
export type ProviderJobDetailResponse = DataResponse<ProviderJobDetail>;

export type ProviderJobStatusRequest = MobileProviderJobStatusInput;
export interface ProviderJobStatusUpdated {
  id: string;
  estatus: EstatusOrden;
  total: number;
  fecha_programada: string | null;
  notas: string | null;
}
export type ProviderJobStatusResponse = DataResponse<ProviderJobStatusUpdated>;
