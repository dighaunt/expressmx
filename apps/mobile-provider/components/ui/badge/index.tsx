import React from 'react';
import { Text, View, type TextProps, type ViewProps } from 'react-native';
import { tva, type VariantProps } from '@gluestack-ui/utils/nativewind-utils';

type BadgeTone = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
const BadgeContext = React.createContext<{ tone: BadgeTone }>({ tone: 'neutral' });

const badgeStyle = tva({
  base: 'self-start rounded px-2.5 py-1 flex-row items-center',
  variants: {
    tone: {
      brand: 'bg-primary-soft',
      success: 'bg-success-soft',
      warning: 'bg-warning-soft',
      danger: 'bg-destructive-soft',
      info: 'bg-info-soft',
      neutral: 'bg-muted',
    },
  },
  defaultVariants: {
    tone: 'neutral',
  },
});

const badgeTextStyle = tva({
  base: 'text-xs font-semibold',
  parentVariants: {
    tone: {
      brand: 'text-primary-strong',
      success: 'text-success',
      warning: 'text-warning',
      danger: 'text-destructive',
      info: 'text-info',
      neutral: 'text-muted-foreground',
    },
  },
});

type BadgeProps = ViewProps & VariantProps<typeof badgeStyle> & { className?: string };
type BadgeTextProps = TextProps & { className?: string };

const Badge = React.forwardRef<React.ComponentRef<typeof View>, BadgeProps>(
  function Badge({ className, tone = 'neutral', ...props }, ref) {
    return (
      <BadgeContext.Provider value={{ tone }}>
        <View
          ref={ref}
          {...props}
          className={badgeStyle({ tone, class: className })}
        />
      </BadgeContext.Provider>
    );
  },
);

const BadgeText = React.forwardRef<React.ComponentRef<typeof Text>, BadgeTextProps>(
  function BadgeText({ className, ...props }, ref) {
    const { tone } = React.useContext(BadgeContext);
    return (
      <Text
        ref={ref}
        {...props}
        className={badgeTextStyle({ parentVariants: { tone }, class: className })}
      />
    );
  },
);

Badge.displayName = 'Badge';
BadgeText.displayName = 'BadgeText';

export { Badge, BadgeText };
