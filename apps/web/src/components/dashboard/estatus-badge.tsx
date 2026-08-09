import { Badge } from '@/components/ui/badge';
import { ESTATUS_LABEL, type EstatusOrden } from '@/lib/dashboard/queries/ordenes';

const VARIANT_BY_ESTATUS: Record<EstatusOrden, 'info' | 'warning' | 'default' | 'success' | 'destructive'> = {
  solicitada: 'warning',
  asignada: 'info',
  en_camino: 'info',
  en_progreso: 'default',
  completada: 'success',
  cancelada: 'destructive',
};

export function EstatusBadge({ estatus }: { estatus: EstatusOrden }) {
  return <Badge variant={VARIANT_BY_ESTATUS[estatus]}>{ESTATUS_LABEL[estatus]}</Badge>;
}
