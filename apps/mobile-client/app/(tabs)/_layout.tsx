import { Redirect, Tabs } from 'expo-router';
import { House, ReceiptX, UserCircle, Wallet, Wrench } from 'phosphor-react-native';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box } from '@/components/ui/box';
import { Spinner } from '@/components/ui/spinner';
import { useSession } from '@/lib/auth/use-session';
import { palette } from '../../lib/theme/tokens';

const iconWeight = 'regular' as const;
const iconWeightActive = 'fill' as const;
const hiddenTabOptions = { href: null } as const;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { status } = useSession();
  const baseHeight = Platform.select({ ios: 52, android: 60, default: 56 });
  const minBottom = Platform.select({ ios: 8, android: 10, default: 8 });
  const tabBarBottom = Math.max(insets.bottom, minBottom ?? 8);

  if (status === 'loading') {
    return (
      <Box className="flex-1 items-center justify-center bg-background">
        <Spinner size="large" color={palette.brand} />
      </Box>
    );
  }

  if (status !== 'authenticated') {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
          borderTopWidth: 1,
          height: (baseHeight ?? 56) + tabBarBottom,
          paddingTop: 8,
          paddingBottom: tabBarBottom,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
        tabBarActiveTintColor: palette.brand,
        tabBarInactiveTintColor: palette.textTertiary,
      }}
    >
      <Tabs.Screen
        name="home/index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, size, focused }) => (
            <House color={color} size={size} weight={focused ? iconWeightActive : iconWeight} />
          ),
        }}
      />
      <Tabs.Screen
        name="services/index"
        options={{
          title: 'Servicios',
          tabBarIcon: ({ color, size, focused }) => (
            <Wrench color={color} size={size} weight={focused ? iconWeightActive : iconWeight} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders/index"
        options={{
          title: 'Pedidos',
          tabBarIcon: ({ color, size, focused }) => (
            <ReceiptX color={color} size={size} weight={focused ? iconWeightActive : iconWeight} />
          ),
        }}
      />
      <Tabs.Screen
        name="wallet/index"
        options={{
          title: 'Billetera',
          tabBarIcon: ({ color, size, focused }) => (
            <Wallet color={color} size={size} weight={focused ? iconWeightActive : iconWeight} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size, focused }) => (
            <UserCircle color={color} size={size} weight={focused ? iconWeightActive : iconWeight} />
          ),
        }}
      />
      <Tabs.Screen name="addresses" options={hiddenTabOptions} />
      <Tabs.Screen name="notifications/index" options={hiddenTabOptions} />
      <Tabs.Screen name="order-rating/index" options={hiddenTabOptions} />
      <Tabs.Screen name="order-tracking/index" options={hiddenTabOptions} />
      <Tabs.Screen name="orders/[id]/reportar-problema" options={hiddenTabOptions} />
      <Tabs.Screen name="payment" options={hiddenTabOptions} />
      <Tabs.Screen name="profile-edit" options={hiddenTabOptions} />
      <Tabs.Screen name="service-detail/index" options={hiddenTabOptions} />
      <Tabs.Screen name="service-request/index" options={hiddenTabOptions} />
      <Tabs.Screen name="support" options={hiddenTabOptions} />
    </Tabs>
  );
}
