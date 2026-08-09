import * as Device from 'expo-device';
import Constants, { AppOwnership } from 'expo-constants';
import { Platform } from 'react-native';
import type { Router } from 'expo-router';
import { api } from '@/lib/api/client';
import { playProviderOrderSfx } from '@/lib/sfx';

export const PROVIDER_ORDER_CHANNEL_ID = 'provider-orders';
export const PROVIDER_NOTIFICATION_SOUND = 'notification.wav';

type NotificationsModule = typeof import('expo-notifications');
type ExpoNotification = import('expo-notifications').Notification;
type AndroidNotificationChannel = {
  id: string;
  name: string;
  importance: 'DEFAULT' | 'HIGH' | 'LOW';
  sound?: string | null;
};

const ANDROID_NOTIFICATION_VIBRATION_PATTERN = [0, 200, 100, 200];

const ANDROID_CHANNELS: AndroidNotificationChannel[] = [
  { id: 'default', name: 'General', importance: 'DEFAULT' },
  {
    id: PROVIDER_ORDER_CHANNEL_ID,
    name: 'Servicios',
    importance: 'HIGH',
    sound: PROVIDER_NOTIFICATION_SOUND,
  },
  { id: 'chat', name: 'Mensajes', importance: 'HIGH' },
  { id: 'payments', name: 'Pagos', importance: 'DEFAULT' },
  { id: 'marketing', name: 'Promociones', importance: 'LOW', sound: null },
  { id: 'system', name: 'Sistema', importance: 'DEFAULT' },
];

let notificationsModulePromise: Promise<NotificationsModule | null> | null = null;

function isAndroidExpoGo() {
  return Platform.OS === 'android' && Constants.appOwnership === AppOwnership.Expo;
}

function getNotificationsModule() {
  if (!notificationsModulePromise) {
    notificationsModulePromise = isAndroidExpoGo()
      ? Promise.resolve(null)
      : import('expo-notifications').catch(() => null);
  }
  return notificationsModulePromise;
}

export function configureNotificationHandler() {
  getNotificationsModule()
    .then((notifications) => {
      if (!notifications) return;
      notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    })
    .catch(() => null);
}

export async function ensureNotificationsSetup(): Promise<string | null> {
  const notifications = await getNotificationsModule();
  if (!notifications) return null;

  if (Platform.OS === 'android') {
    for (const ch of ANDROID_CHANNELS) {
      await notifications.setNotificationChannelAsync(ch.id, {
        name: ch.name,
        importance: notifications.AndroidImportance[ch.importance],
        vibrationPattern: ANDROID_NOTIFICATION_VIBRATION_PATTERN,
        sound: ch.sound === undefined ? 'default' : ch.sound,
      });
    }
  }

  if (!Device.isDevice) return null;

  const { status: existing } = await notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== 'granted') {
    const { status: requested } = await notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    status = requested;
  }
  if (status !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  try {
    const token = await notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    api
      .post('/v1/mobile/notifications/push-token', {
        token: token.data,
        plataforma: Platform.OS,
        app: 'provider',
      })
      .catch(() => null);
    return token.data;
  } catch {
    return null;
  }
}

export function setupNotificationListeners(router: Router) {
  let active = true;
  let removeListeners = () => {};

  getNotificationsModule()
    .then((notifications) => {
      if (!active || !notifications) return;

      const lastResponse = notifications.getLastNotificationResponse();
      if (lastResponse?.notification) {
        redirectFromNotification(router, lastResponse.notification);
      }

      const receivedSub = notifications.addNotificationReceivedListener((notification) => {
        const data = notification.request.content.data as { deeplink?: string } | undefined;
        if (typeof data?.deeplink === 'string' && data.deeplink.startsWith('/jobs/')) {
          playProviderOrderSfx().catch(() => null);
        }
      });
      const responseSub = notifications.addNotificationResponseReceivedListener((response) => {
        redirectFromNotification(router, response.notification);
      });

      removeListeners = () => {
        receivedSub.remove();
        responseSub.remove();
      };
    })
    .catch(() => null);

  return () => {
    active = false;
    removeListeners();
  };
}

function redirectFromNotification(router: Router, notification: ExpoNotification) {
  const data = notification.request.content.data as { deeplink?: string } | undefined;
  if (data?.deeplink && typeof data.deeplink === 'string') {
    router.push(data.deeplink as never);
  }
}
