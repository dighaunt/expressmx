import { Badge } from '@/components/ui/badge';
import { TIER_LABEL, type TierSoporte } from '@/lib/dashboard/tickets-shared';

interface Props {
  tier: TierSoporte;
}

const TONE: Record<TierSoporte, 'info' | 'warning' | 'destructive'> = {
  l1: 'info',
  l2: 'warning',
  l3: 'destructive',
};

export function TierBadge({ tier }: Props) {
  return <Badge variant={TONE[tier]}>{TIER_LABEL[tier]}</Badge>;
}
