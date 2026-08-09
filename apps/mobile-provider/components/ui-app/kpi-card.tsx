import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

interface Props {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  trailing?: ReactNode;
}

export function KpiCard({ label, value, hint, accent, trailing }: Props) {
  return (
    <Card>
      <VStack className="gap-1">
        <Text className="text-xs text-foreground-secondary">{label}</Text>
        <Heading className={`text-2xl font-bold ${accent ? 'text-primary' : 'text-foreground'}`}>
          {value}
        </Heading>
        {hint ? <Text className="text-xs text-foreground-secondary">{hint}</Text> : null}
        {trailing ?? null}
      </VStack>
    </Card>
  );
}
