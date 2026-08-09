import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';

const COOL_BASE = '#0B1E5C';

interface Props {
  height: number;
}

export function AnimatedGradientBackdrop({ height }: Props) {
  const wave = useSharedValue(0);
  const drift = useSharedValue(0);

  useEffect(() => {
    wave.value = withRepeat(
      withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    drift.value = withRepeat(
      withTiming(1, { duration: 13000, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [wave, drift]);

  const layerOneStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: (wave.value - 0.5) * 180 },
      { translateY: (wave.value - 0.5) * 60 },
    ],
  }));

  const layerTwoStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: (0.5 - drift.value) * 220 },
      { translateY: (drift.value - 0.5) * 80 },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height,
        backgroundColor: COOL_BASE,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={[
          { position: 'absolute', left: -120, right: -120, top: -120, bottom: -120 },
          layerOneStyle,
        ]}
      >
        <Svg width="100%" height="100%">
          <Defs>
            <SvgLinearGradient id="emxLoginGradA" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#1E3A8A" stopOpacity="1" />
              <Stop offset="0.45" stopColor="#0EA5E9" stopOpacity="0.85" />
              <Stop offset="1" stopColor="#0B1E5C" stopOpacity="0" />
            </SvgLinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#emxLoginGradA)" />
        </Svg>
      </Animated.View>

      <Animated.View
        style={[
          { position: 'absolute', left: -140, right: -140, top: -140, bottom: -140 },
          layerTwoStyle,
        ]}
      >
        <Svg width="100%" height="100%">
          <Defs>
            <SvgLinearGradient id="emxLoginGradB" x1="1" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#06B6D4" stopOpacity="0.75" />
              <Stop offset="0.55" stopColor="#2563EB" stopOpacity="0.45" />
              <Stop offset="1" stopColor="#0B1E5C" stopOpacity="0" />
            </SvgLinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#emxLoginGradB)" />
        </Svg>
      </Animated.View>

      <Svg
        width="100%"
        height="100%"
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      >
        <Defs>
          <SvgLinearGradient id="emxLoginVignette" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0B1E5C" stopOpacity="0" />
            <Stop offset="1" stopColor="#0B1E5C" stopOpacity="0.45" />
          </SvgLinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#emxLoginVignette)" />
      </Svg>
    </Animated.View>
  );
}
