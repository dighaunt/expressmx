import { Stack } from 'expo-router';
import { palette } from '@/lib/theme/tokens';

export default function AddressesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: palette.surface },
        animation: 'slide_from_right',
      }}
    />
  );
}
