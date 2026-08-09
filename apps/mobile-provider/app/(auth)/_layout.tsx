import { Redirect, Stack } from 'expo-router';
import { Box } from '@/components/ui/box';
import { Spinner } from '@/components/ui/spinner';
import { useSession } from '@/lib/auth/use-session';
import { palette } from '@/lib/theme/tokens';

export default function AuthLayout() {
  const { status } = useSession();

  if (status === 'loading') {
    return (
      <Box className="flex-1 items-center justify-center bg-background">
        <Spinner size="large" color={palette.brand} />
      </Box>
    );
  }

  if (status === 'authenticated') {
    return <Redirect href="/(tabs)/home" />;
  }

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
