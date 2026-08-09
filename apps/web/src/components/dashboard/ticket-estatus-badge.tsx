import { Badge } from '@/components/ui/badge';
import {
  ESTATUS_LABEL,
  type EstatusTicket,
} from '@/lib/dashboard/tickets-shared';

const VARIANT: Record<EstatusTicket, 'info' | 'warning' | 'success' | 'destructive'> = {
  abierto: 'info',
  en_revision: 'warning',
  resuelto: 'success',
  escalado: 'destructive',
};

export function TicketEstatusBadge({ estatus }: { estatus: EstatusTicket }) {
  return <Badge variant={VARIANT[estatus]}>{ESTATUS_LABEL[estatus]}</Badge>;
}
