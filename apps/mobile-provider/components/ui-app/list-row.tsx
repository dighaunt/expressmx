import { CaretRight } from 'phosphor-react-native';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { palette } from '@/lib/theme/tokens';

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
}

export function ListRow({ icon, title, description, trailing, onPress, destructive }: Props) {
  const titleClass = destructive ? 'text-destructive' : 'text-foreground';

  const inner = (
    <Card className="px-4 py-3.5">
      <HStack className="items-center gap-3">
      {icon ? (
        <VStack className="w-10 h-10 items-center justify-center rounded-lg bg-muted">
          {icon}
        </VStack>
      ) : null}
      <VStack className="flex-1 gap-0.5">
        <Text className={`text-sm font-semibold ${titleClass}`}>{title}</Text>
        {description ? (
          <Text className="text-xs text-foreground-secondary" numberOfLines={1}>
            {description}
          </Text>
        ) : null}
      </VStack>
      {trailing ?? (onPress ? <CaretRight size={18} color={palette.textTertiary} /> : null)}
      </HStack>
    </Card>
  );

  if (!onPress) return inner;
  return <Pressable onPress={onPress}>{inner}</Pressable>;
}
