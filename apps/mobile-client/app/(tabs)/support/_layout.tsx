import { Stack } from 'expo-router';

export default function SupportLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="new" options={{ presentation: 'card' }} />
      <Stack.Screen name="[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="articulo/[slug]" options={{ presentation: 'card' }} />
      <Stack.Screen name="seleccionar-pedido/index" options={{ presentation: 'card' }} />
      <Stack.Screen name="guia/[orden_id]/index" options={{ presentation: 'card' }} />
    </Stack>
  );
}
