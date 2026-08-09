import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import '@/global.css';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { getCachedUser } from '@/lib/auth/session';
import {
  configureNotificationHandler,
  ensureNotificationsSetup,
  setupNotificationListeners,
} from '@/lib/notifications';
import { connectClientRealtime } from '@/lib/realtime';

export const unstable_settings = {
  initialRouteName: 'index',
};

configureNotificationHandler();

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    ensureNotificationsSetup().catch(() => null);
    getCachedUser().then(connectClientRealtime).catch(() => null);
    const cleanup = setupNotificationListeners(router);
    return cleanup;
  }, [router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <GluestackUIProvider mode="light">
          <StatusBar style="dark" translucent backgroundColor="transparent" />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
            }}
          />
        </GluestackUIProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
