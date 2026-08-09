import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { palette, type WalletState } from '@/lib/theme/tokens';
import { Skeleton } from './skeleton';

interface Props {
  state?: WalletState;
}

export function WalletCardSkeleton({ state = 'active' }: Props) {
  const containerStyle = {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: state === 'active' ? 16 : 12,
    padding: state === 'active' ? 16 : 14,
    opacity: state === 'archived' ? 0.6 : 1,
  } as const;

  return (
    <Box style={containerStyle}>
      <VStack className="gap-2">
        <HStack className="items-center justify-between">
          <Skeleton width="60%" height={15} />
          <Skeleton width={60} height={20} radius={10} />
        </HStack>
        <Skeleton width="40%" height={11} />
        <HStack className="items-center justify-between" style={{ marginTop: 4 }}>
          <Skeleton width="35%" height={13} />
          <Skeleton width={70} height={14} />
        </HStack>
      </VStack>
    </Box>
  );
}

