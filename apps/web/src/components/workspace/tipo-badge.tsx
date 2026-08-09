import { Badge } from '@/components/ui/badge';
import { TIPO_TICKET_LABEL, type TipoTicket } from '@/lib/dashboard/tickets-shared';

interface Props {
  tipo: TipoTicket;
}

const TONE: Record<TipoTicket, 'destructive' | 'info' | 'warning' | 'muted'> = {
  incidente: 'destructive',
  solicitud: 'info',
  problema: 'warning',
  cambio: 'muted',
};

export function TipoBadge({ tipo }: Props) {
  return <Badge variant={TONE[tipo]}>{TIPO_TICKET_LABEL[tipo]}</Badge>;
}
