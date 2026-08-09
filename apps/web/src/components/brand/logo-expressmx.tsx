import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoExpressMXProps {
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
}

const NATIVE_RATIO = 3330 / 417;

export function LogoExpressMX({
  width = 200,
  height,
  className,
  priority = false,
}: LogoExpressMXProps) {
  const computedHeight = height ?? Math.round(width / NATIVE_RATIO);
  return (
    <Image
      src="/logo-expressmx.svg"
      alt="ExpressMX"
      width={width}
      height={computedHeight}
      priority={priority}
      className={cn('select-none', className)}
    />
  );
}
