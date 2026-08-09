import type { ReactNode } from 'react';
import { Box } from '@/components/ui/box';
import { Card } from '@/components/ui/card';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

interface StatusCardProps {
  title: string;
  meta?: string;
  badge?: ReactNode;
  leadingIcon?: ReactNode;
  onPress?: () => void;
  tone?: 'default' | 'highlighted';
  children?: ReactNode;
}

export function StatusCard({
  title,
  meta,
  badge,
  leadingIcon,
  onPress,
  tone = 'default',
  children,
}: StatusCardProps) {
  const toneClass =
    tone === 'highlighted'
      ? 'bg-primary-soft border-primary-soft'
      : 'bg-card border-border';

  const body = (
    <VStack className="flex-1 gap-2">
      <HStack className="items-center justify-between gap-2">
        <Text className="text-sm font-bold text-foreground flex-1" numberOfLines={2}>
          {title}
        </Text>
        {badge ?? null}
      </HStack>
      {meta ? (
        <Text className="text-xs text-foreground-secondary">{meta}</Text>
      ) : null}
      {children ?? null}
    </VStack>
  );

  const inner = leadingIcon ? (
    <Card className={toneClass} variant="ghost">
      <HStack className="gap-3 items-start">
        <Box className="shrink-0">{leadingIcon}</Box>
        {body}
      </HStack>
    </Card>
  ) : (
    <Card className={toneClass} variant="ghost">{body}</Card>
  );

  if (!onPress) {
    return <Box>{inner}</Box>;
  }
  return <Pressable onPress={onPress}>{inner}</Pressable>;
}
