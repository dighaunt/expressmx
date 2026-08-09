import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { palette } from '@/lib/theme/tokens';
import { Skeleton } from './skeleton';

interface Props {
  highlighted?: boolean;
}

export function JobCardSkeleton({ highlighted = false }: Props) {
  return (
    <Box
      style={{
        backgroundColor: palette.surface,
        borderWidth: highlighted ? 2 : 1,
        borderColor: palette.border,
        borderRadius: highlighted ? 16 : 12,
        padding: highlighted ? 16 : 14,
      }}
    >
      <VStack className="gap-2">
        <HStack className="items-center justify-between">
          <Skeleton width="60%" height={15} />
          <Skeleton width={70} height={20} radius={10} />
        </HStack>
        <Skeleton width="45%" height={12} />
        <HStack className="items-center justify-between" style={{ marginTop: 4 }}>
          <Skeleton width="40%" height={13} />
          <Skeleton width={75} height={14} />
        </HStack>
      </VStack>
    </Box>
  );
}
