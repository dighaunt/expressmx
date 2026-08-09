import type { ViewStyle } from 'react-native';
import { Skeleton as GSSkeleton } from '@/components/ui/skeleton';

interface SkeletonProps {
  width?: ViewStyle['width'];
  height?: ViewStyle['height'];
  radius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 14, radius = 6, style }: SkeletonProps) {
  return (
    <GSSkeleton
      variant={radius >= 999 ? 'circular' : 'rounded'}
      startColor="bg-muted"
      style={[{ width, height, borderRadius: radius }, style]}
    />
  );
}

