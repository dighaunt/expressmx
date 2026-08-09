import type { MobileNotificationsQuery } from '@expressmx/validations';
import type { TipoNotif, CanalNotif } from '../../index';
import type { DataResponse, PageResult } from './common';

export type NotificationsListQuery = MobileNotificationsQuery;

export interface NotificationItem {
  id: string;
  tipo: TipoNotif;
  titulo: string;
  cuerpo: string | null;
  canal: CanalNotif;
  deeplink: string | null;
  leida: boolean;
  created_at: string;
}
export type NotificationsListResponse = PageResult<NotificationItem>;

export type MarkAsReadResponse = DataResponse<{ id: string; leida: true }>;
