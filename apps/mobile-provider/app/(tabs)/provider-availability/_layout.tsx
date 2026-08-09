import { Stack } from 'expo-router';

export default function ProviderAvailabilityLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="edit" options={{ presentation: 'card' }} />
    </Stack>
  );
}
