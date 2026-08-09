import { Redirect, Tabs } from 'expo-router';
import { Briefcase, House, User, Wallet } from 'phosphor-react-native';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box } from '@/components/ui/box';
import { Spinner } from '@/components/ui/spinner';
import { useSession } from '@/lib/auth/use-session';
import { palette } from '@/lib/theme/tokens';

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
        tabBarActiveTintColor: palette.brand,
        tabBarInactiveTintColor: palette.textDisabled,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
          borderTopWidth: 1,
          height: (baseHeight ?? 56) + tabBarBottom,
          paddingTop: 8,
          paddingBottom: tabBarBottom,
        },
      }}
    >
      <Tabs.Screen
        name="home/index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, focused }) => (
            <House size={22} color={color} weight={focused ? 'fill' : 'regular'} />
          ),
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Servicios',
          tabBarIcon: ({ color, focused }) => (
            <Briefcase size={22} color={color} weight={focused ? 'fill' : 'regular'} />
          ),
        }}
      />
      <Tabs.Screen
        name="earnings/index"
        options={{
          title: 'Bonos',
          tabBarIcon: ({ color, focused }) => (
            <Wallet size={22} color={color} weight={focused ? 'fill' : 'regular'} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused }) => (
            <User size={22} color={color} weight={focused ? 'fill' : 'regular'} />
          ),
        }}
      />
      <Tabs.Screen name="notifications/index" options={hiddenTabOptions} />
      <Tabs.Screen name="profile-edit/index" options={hiddenTabOptions} />
      <Tabs.Screen name="provider-bank-account/index" options={hiddenTabOptions} />
      <Tabs.Screen name="provider-availability" options={hiddenTabOptions} />
      <Tabs.Screen name="provider-services" options={hiddenTabOptions} />
      <Tabs.Screen name="support" options={hiddenTabOptions} />
    </Tabs>
  );
}
