import type { ReactNode } from 'react';
import { Box } from '@/components/ui/box';

interface Props {
  children: ReactNode;
  withBorder?: boolean;
}

export function BottomBar({ children, withBorder = true }: Props) {
  return (
    <Box
      className={`bg-background px-5 pt-3 ${withBorder ? 'border-t border-border' : ''}`}
      style={{ paddingBottom: 12 }}
    >
      {children}
    </Box>
  );
}
