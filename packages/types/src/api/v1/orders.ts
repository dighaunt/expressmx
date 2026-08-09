import type {
  MobileCreateOrderInput,
  MobileOrdersListQuery,
} from '@expressmx/validations';
import type { EstatusOrden } from '../../index';
import type { DataResponse, PageResult } from './common';

export type OrdersListQuery = MobileOrdersListQuery;

export interface OrderListItem {
  id: string;
  estatus: EstatusOrden;
  created_at: string;
  fecha_creacion: string;
  servicio_nombre: string;
  prestador_nombre: string | null;
  total: number;
}
export type OrdersListResponse = PageResult<OrderListItem>;

export interface OrderDetail {
  id: string;
  estatus: EstatusOrden;
  fecha_creacion: string;
  fecha_programada: string;
  total: number;
  servicio_nombre: string;
  prestador_nombre: string | null;
  prestador_telefono: string | null;
  direccion: string | null;
}
export type OrderDetailResponse = DataResponse<OrderDetail>;

export type CreateOrderRequest = MobileCreateOrderInput;
export type CreateOrderResponse = DataResponse<{ id: string }>;
