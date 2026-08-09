import type { ReactNode } from 'react';
import { useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box } from '@/components/ui/box';
import { KeyboardDismissChip } from './keyboard-dismiss-chip';

const MAX_PHONE_TOP_INSET = 64;

interface Props {
  children: ReactNode;
  applyTopInset?: boolean;
  applyBottomInset?: boolean;
  showDismissChip?: boolean;
  extraTopPadding?: number;
}

export function ScreenShell({
  children,
  applyTopInset = true,
  applyBottomInset,
  showDismissChip = true,
  extraTopPadding,
}: Props) {
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const shouldApplyBottomInset = applyBottomInset ?? !segments.includes('(tabs)');
  const topInset = Math.min(insets.top, MAX_PHONE_TOP_INSET);

  return (
    <Box
      className="flex-1 bg-background"
      style={{
        paddingTop: applyTopInset ? topInset + (extraTopPadding ?? 0) : (extraTopPadding ?? 0),
        paddingBottom: shouldApplyBottomInset ? insets.bottom : 0,
      }}
    >
      {children}
      {showDismissChip ? <KeyboardDismissChip /> : null}
    </Box>
  );
}
