import type { ReactNode } from 'react';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';

interface Props {
  children: ReactNode;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  fullWidth?: boolean;
  size?: 'sm' | 'default' | 'lg';
}

const variantToButton: Record<Variant, 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive'> = {
  primary: 'default',
  secondary: 'secondary',
  outline: 'outline',
  ghost: 'ghost',
  destructive: 'destructive',
};

export function PrimaryButton({
  children,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  fullWidth = true,
  size = 'lg',
}: Props) {
  return (
    <Button
      onPress={onPress}
      disabled={disabled || loading}
      variant={variantToButton[variant]}
      size={size}
      className={fullWidth ? 'w-full h-12' : 'h-12'}
    >
      {loading ? <ButtonSpinner /> : null}
      <ButtonText className="text-base font-semibold">{children}</ButtonText>
    </Button>
  );
}
