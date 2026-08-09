import { useCallback, useEffect, useState } from 'react';
import { connectProviderRealtime, disconnectProviderRealtime } from '@/lib/realtime';
import { type AuthUser, getStoredUser, login as performLogin, logout as performLogout } from './session';

interface SessionState {
  user: AuthUser | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
}

export function useSession() {
  const [state, setState] = useState<SessionState>({ user: null, status: 'loading' });

  const reload = useCallback(async () => {
    try {
      const user = await getStoredUser();
      if (user) connectProviderRealtime(user).catch(() => null);
      else disconnectProviderRealtime();
      setState({
        user,
        status: user ? 'authenticated' : 'unauthenticated',
      });
    } catch {
      disconnectProviderRealtime();
      setState({ user: null, status: 'unauthenticated' });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const login = useCallback(async (email: string, password: string) => {
    const user = await performLogin(email, password);
    connectProviderRealtime(user).catch(() => null);
    setState({ user, status: 'authenticated' });
    return user;
  }, []);

  const logout = useCallback(async () => {
    await performLogout();
    disconnectProviderRealtime();
    setState({ user: null, status: 'unauthenticated' });
  }, []);

  return { ...state, reload, login, logout };
}
