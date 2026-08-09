import { Badge, BadgeText } from '@/components/ui/badge';
import type { Tone } from '@/lib/theme/tokens';

interface Props {
  label: string;
  tone?: Tone;
}

export function StatusBadge({ label, tone = 'neutral' }: Props) {
  return (
    <Badge tone={tone}>
      <BadgeText>{label}</BadgeText>
    </Badge>
  );
}
