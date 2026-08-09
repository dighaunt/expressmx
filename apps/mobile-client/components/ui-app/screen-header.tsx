import { useRouter } from 'expo-router';
import { CaretLeft } from 'phosphor-react-native';
import type { ReactNode } from 'react';
import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { palette } from '@/lib/theme/tokens';

interface Props {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightSlot?: ReactNode;
}

export function ScreenHeader({ title, subtitle, showBack = true, onBack, rightSlot }: Props) {
  const router = useRouter();
  const handleBack = onBack ?? (() =>
    router.canGoBack() ? router.back() : router.replace('/(tabs)/home')
  );

  return (
    <Box className="bg-background border-b border-border px-5 pt-4 pb-4">
      <HStack className="items-center gap-3">
        {showBack ? (
          <Pressable
            onPress={handleBack}
            className="w-10 h-10 items-center justify-center rounded-xl bg-muted"
            hitSlop={12}
          >
            <CaretLeft size={20} color={palette.textPrimary} weight="bold" />
          </Pressable>
        ) : null}
        <VStack className="flex-1">
          <Heading className="text-lg font-bold text-foreground">{title}</Heading>
          {subtitle ? (
            <Text className="text-sm text-foreground-secondary">{subtitle}</Text>
          ) : null}
        </VStack>
        {rightSlot ?? null}
      </HStack>
    </Box>
  );
}
