import * as Device from 'expo-device';
import Constants, { AppOwnership } from 'expo-constants';
import { Platform } from 'react-native';
import type { Router } from 'expo-router';

type NotificationsModule = typeof import('expo-notifications');
type AndroidNotificationChannel = {
  id: string;
  name: string;
  importance: 'DEFAULT' | 'HIGH' | 'LOW';
};

const ANDROID_NOTIFICATION_VIBRATION_PATTERN = [0, 200, 100, 200];

const ANDROID_CHANNELS: AndroidNotificationChannel[] = [
  { id: 'default', name: 'General', importance: 'DEFAULT' },
  { id: 'orders', name: 'Servicios', importance: 'HIGH' },
  { id: 'chat', name: 'Mensajes', importance: 'HIGH' },
  { id: 'payments', name: 'Pagos', importance: 'DEFAULT' },
  { id: 'marketing', name: 'Promociones', importance: 'LOW' },
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
        sound: ch.id === 'marketing' ? null : 'default',
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

      const responseSub = notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as { deeplink?: string } | undefined;
        if (data?.deeplink && typeof data.deeplink === 'string') {
          router.push(data.deeplink as never);
        }
      });

      removeListeners = () => responseSub.remove();
    })
    .catch(() => null);

  return () => {
    active = false;
    removeListeners();
  };
}
