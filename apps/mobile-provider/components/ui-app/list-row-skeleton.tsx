import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { palette } from '@/lib/theme/tokens';
import { Skeleton } from './skeleton';

interface Props {
  showLeading?: boolean;
}

export function ListRowSkeleton({ showLeading = false }: Props) {
  return (
    <HStack
      className="items-center"
      style={{
        backgroundColor: palette.surface,
        borderWidth: 1,
        borderColor: palette.border,
        borderRadius: 12,
        padding: 14,
        gap: 12,
      }}
    >
      {showLeading ? <Skeleton width={36} height={36} radius={18} /> : null}
      <VStack className="flex-1 gap-1.5">
        <Skeleton width="75%" height={14} />
        <Skeleton width="55%" height={11} />
      </VStack>
      <Skeleton width={14} height={14} radius={3} />
    </HStack>
  );
}
