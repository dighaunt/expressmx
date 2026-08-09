import React from 'react';
import { Switch as RNSwitch, type SwitchProps as RNSwitchProps } from 'react-native';
import { createSwitch } from '@gluestack-ui/core/switch/creator';
import { tva, withStyleContext, type VariantProps } from '@gluestack-ui/utils/nativewind-utils';

const UISwitch = createSwitch({
  Root: withStyleContext(RNSwitch),
});

const switchStyle = tva({
  base: 'data-[disabled=true]:opacity-40',
});

type SwitchProps = Omit<React.ComponentProps<typeof UISwitch>, 'context'> &
  RNSwitchProps &
  VariantProps<typeof switchStyle> & {
    className?: string;
  };

const Switch = React.forwardRef<any, SwitchProps>(
  function Switch({ className, ...props }, ref) {
    return (
      <UISwitch
        {...props}
        ref={ref}
        className={switchStyle({ class: className })}
      />
    );
  },
);

Switch.displayName = 'Switch';

export { Switch };
