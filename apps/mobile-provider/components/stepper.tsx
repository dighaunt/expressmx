import { Check } from 'phosphor-react-native';
import { useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { palette } from '@/lib/theme/tokens';

export type StepperStep = {
  key: string;
  label: string;
};

export interface StepperProps {
  steps: StepperStep[];
  currentStepIndex: number;
  className?: string;
}

const COMPACT_WIDTH_THRESHOLD = 320;

export function Stepper({ steps, currentStepIndex, className }: StepperProps) {
  const [containerWidth, setContainerWidth] = useState(0);

  function handleLayout(event: LayoutChangeEvent) {
    setContainerWidth(event.nativeEvent.layout.width);
  }

  const isCompact =
    containerWidth > 0 && containerWidth < COMPACT_WIDTH_THRESHOLD && steps.length >= 5;

  return (
    <VStack className={className ?? ''} onLayout={handleLayout}>
      <HStack className="items-start">
        {steps.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isFirst = index === 0;
          const isLast = index === steps.length - 1;
          const leftLineCompleted = index <= currentStepIndex && !isFirst;
          const rightLineCompleted = index < currentStepIndex && !isLast;

          const circleClasses =
            isCompleted || isCurrent
              ? 'bg-primary border-primary'
              : 'bg-card border-border-strong';
          const numberClasses =
            isCompleted || isCurrent ? 'text-primary-foreground' : 'text-muted-foreground';
          const labelClasses =
            isCompleted || isCurrent
              ? 'text-primary font-semibold'
              : 'text-muted-foreground';

          return (
            <VStack key={step.key} className="flex-1 items-center">
              <HStack className="items-center w-full">
                {isFirst ? (
                  <Box className="flex-1 h-0.5 bg-transparent" />
                ) : (
                  <Box
                    className={`flex-1 h-0.5 ${leftLineCompleted ? 'bg-primary' : 'bg-muted'}`}
                  />
                )}
                <Box
                  className={`w-7 h-7 rounded-full items-center justify-center border ${circleClasses}`}
                >
                  {isCompleted ? (
                    <Check size={14} color={palette.white} weight="fill" />
                  ) : (
                    <Text className={`text-xs font-bold ${numberClasses}`}>{index + 1}</Text>
                  )}
                </Box>
                {isLast ? (
                  <Box className="flex-1 h-0.5 bg-transparent" />
                ) : (
                  <Box
                    className={`flex-1 h-0.5 ${rightLineCompleted ? 'bg-primary' : 'bg-muted'}`}
                  />
                )}
              </HStack>
              <Text
                className={`text-[11px] mt-1.5 px-1 text-center ${labelClasses}`}
                numberOfLines={1}
              >
                {isCompact ? step.label.charAt(0).toUpperCase() : step.label}
              </Text>
            </VStack>
          );
        })}
      </HStack>
    </VStack>
  );
}
