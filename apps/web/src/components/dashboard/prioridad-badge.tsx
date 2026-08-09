import { Badge } from '@/components/ui/badge';
import {
  PRIORIDAD_LABEL,
  type PrioridadTicket,
} from '@/lib/dashboard/tickets-shared';

const VARIANT: Record<PrioridadTicket, 'destructive' | 'warning' | 'info' | 'muted'> = {
  critica: 'destructive',
  alta: 'warning',
  media: 'info',
  baja: 'muted',
};

export function PrioridadBadge({ prioridad }: { prioridad: PrioridadTicket }) {
  return <Badge variant={VARIANT[prioridad]}>{PRIORIDAD_LABEL[prioridad]}</Badge>;
}
