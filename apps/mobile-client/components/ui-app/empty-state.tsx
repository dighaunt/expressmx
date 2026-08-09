import type { ReactNode } from 'react';
import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { PrimaryButton } from './primary-button';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  cta?: { label: string; onPress: () => void };
}

export function EmptyState({ icon, title, description, cta }: EmptyStateProps) {
  return (
    <VStack className="mt-6 py-8 px-5 rounded-xl bg-muted items-center gap-3">
      <Box className="w-14 h-14 rounded-xl bg-background items-center justify-center">
        {icon}
      </Box>
      <VStack className="items-center gap-1">
        <Heading className="text-base font-semibold text-foreground">{title}</Heading>
        {description ? (
          <Text className="text-sm text-foreground-secondary text-center">{description}</Text>
        ) : null}
      </VStack>
      {cta ? (
        <Box className="w-full mt-2">
          <PrimaryButton onPress={cta.onPress}>{cta.label}</PrimaryButton>
        </Box>
      ) : null}
    </VStack>
  );
}
