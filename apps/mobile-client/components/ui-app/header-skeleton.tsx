import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Skeleton } from './skeleton';

interface Props {
  withAvatar?: boolean;
}

export function HeaderSkeleton({ withAvatar = false }: Props) {
  return (
    <HStack className="items-center" style={{ gap: 14, paddingHorizontal: 20, paddingVertical: 16 }}>
      {withAvatar ? <Skeleton width={48} height={48} radius={999} /> : null}
      <VStack className="flex-1 gap-2">
        <Skeleton width="70%" height={18} />
        <Skeleton width="50%" height={12} />
      </VStack>
    </HStack>
  );
}

