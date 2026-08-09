import React from 'react';
import { View, type ViewProps } from 'react-native';
import { tva, type VariantProps } from '@gluestack-ui/utils/nativewind-utils';

const cardStyle = tva({
  base: 'bg-card rounded-xl',
  variants: {
    variant: {
      elevated: 'border border-border',
      outline: 'border border-border',
      ghost: '',
      filled: 'bg-muted',
    },
    size: {
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-5',
    },
  },
  defaultVariants: {
    variant: 'elevated',
    size: 'md',
  },
});

type CardProps = ViewProps & VariantProps<typeof cardStyle> & { className?: string };

const Card = React.forwardRef<React.ComponentRef<typeof View>, CardProps>(
  function Card({ className, variant, size, ...props }, ref) {
    return (
      <View
        ref={ref}
        {...props}
        className={cardStyle({ variant, size, class: className })}
      />
    );
  },
);

Card.displayName = 'Card';

export { Card };
