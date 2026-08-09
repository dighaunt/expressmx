import { Stack } from 'expo-router';

export default function JobActiveLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="pin-cliente" options={{ presentation: 'card' }} />
      <Stack.Screen name="pin-prestador" options={{ presentation: 'card' }} />
      <Stack.Screen name="sobrecosto" options={{ presentation: 'card' }} />
      <Stack.Screen name="evidencias" options={{ presentation: 'card' }} />
    </Stack>
  );
}
