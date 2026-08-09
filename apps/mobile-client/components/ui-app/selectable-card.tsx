import { Check } from 'phosphor-react-native';
import type { ReactNode } from 'react';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { palette } from '@/lib/theme/tokens';

interface SelectableCardProps {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  disabled?: boolean;
}

export function SelectableCard({
  selected,
  onSelect,
  title,
  description,
  icon,
  trailing,
  disabled = false,
}: SelectableCardProps) {
  const containerClass = disabled
    ? 'rounded-xl p-4 border border-border bg-muted opacity-60'
    : selected
      ? 'rounded-xl p-4 border-2 bg-primary-soft border-primary'
      : 'rounded-xl p-4 border border-border bg-card';

  return (
    <Pressable
      onPress={onSelect}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
    >
      <Box className={containerClass}>
        <HStack className="items-center gap-3">
          {icon ? <Box className="shrink-0">{icon}</Box> : null}
          <VStack className="flex-1 gap-0.5">
            <Text className="text-sm font-semibold text-foreground" numberOfLines={2}>
              {title}
            </Text>
            {description ? (
              <Text className="text-xs text-foreground-secondary" numberOfLines={2}>
                {description}
              </Text>
            ) : null}
          </VStack>
          {trailing ??
            (selected ? (
              <Box className="w-6 h-6 rounded-full items-center justify-center bg-primary">
                <Check size={14} color={palette.surface} weight="bold" />
              </Box>
            ) : (
              <Box className="w-6 h-6 rounded-full border-2 border-border-strong" />
            ))}
        </HStack>
      </Box>
    </Pressable>
  );
}
