import { CaretDown } from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { palette } from '@/lib/theme/tokens';

export function KeyboardDismissChip() {
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showEvent = Platform.select({ ios: 'keyboardWillShow', android: 'keyboardDidShow' }) as
      | 'keyboardWillShow'
      | 'keyboardDidShow';
    const hideEvent = Platform.select({ ios: 'keyboardWillHide', android: 'keyboardDidHide' }) as
      | 'keyboardWillHide'
      | 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      const height = event.endCoordinates?.height ?? 0;
      setKeyboardHeight(height);
      setVisible(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 140,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        setVisible(false);
        setKeyboardHeight(0);
      });
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [opacity]);

  if (!visible) return null;

  const bottom =
    Platform.OS === 'ios'
      ? keyboardHeight + 12
      : Math.max(keyboardHeight, insets.bottom) + 12;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom,
        alignItems: 'flex-end',
        paddingHorizontal: 16,
        opacity,
      }}
    >
      <Pressable onPress={() => Keyboard.dismiss()} hitSlop={10}>
        <Box
          className="px-3.5 py-2 rounded-full bg-foreground"
          style={{
            shadowColor: palette.shadow,
            shadowOpacity: 0.18,
            shadowOffset: { width: 0, height: 4 },
            shadowRadius: 12,
            elevation: 4,
          }}
        >
          <HStack className="items-center gap-1">
            <CaretDown size={14} color={palette.white} weight="bold" />
            <Text className="text-sm font-semibold text-primary-foreground">Listo</Text>
          </HStack>
        </Box>
      </Pressable>
    </Animated.View>
  );
}
