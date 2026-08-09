import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Box } from '@/components/ui/box';
import { Spinner } from '@/components/ui/spinner';
import { getStoredUser } from '@/lib/auth/session';
import { palette } from '@/lib/theme/tokens';

type Status = 'loading' | 'authenticated' | 'unauthenticated';

export default function Entry() {
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let cancelled = false;
    getStoredUser()
      .then((user) => {
        if (cancelled) return;
        setStatus(user ? 'authenticated' : 'unauthenticated');
      })
      .catch(() => {
        if (!cancelled) setStatus('unauthenticated');
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  return <Redirect href="/(auth)/login" />;
}
