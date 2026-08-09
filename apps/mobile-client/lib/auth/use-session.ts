import { useCallback, useEffect, useState } from 'react';
import {
  connectClientRealtime,
  disconnectClientRealtime,
} from '@/lib/realtime';
import {
  getCachedUser,
  hasActiveSession,
  refreshUser,
  signIn as performSignIn,
  signOut as performSignOut,
  type SessionUser,
} from './session';

interface SessionState {
  user: SessionUser | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
}

export function useSession() {
  const [state, setState] = useState<SessionState>({ user: null, status: 'loading' });

  const reload = useCallback(async () => {
    const active = await hasActiveSession();
    if (!active) {
      disconnectClientRealtime();
      setState({ user: null, status: 'unauthenticated' });
      return;
    }
    const cached = await getCachedUser();
    if (cached) setState({ user: cached, status: 'authenticated' });
    const fresh = await refreshUser();
    if (fresh) {
      connectClientRealtime(fresh).catch(() => null);
      setState({ user: fresh, status: 'authenticated' });
    } else if (!(await hasActiveSession())) {
      disconnectClientRealtime();
      setState({ user: null, status: 'unauthenticated' });
    } else if (!cached) {
      disconnectClientRealtime();
      setState({ user: null, status: 'unauthenticated' });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const login = useCallback(async (email: string, password: string) => {
    const user = await performSignIn(email, password);
    connectClientRealtime(user).catch(() => null);
    setState({ user, status: 'authenticated' });
    return user;
  }, []);

  const logout = useCallback(async () => {
    await performSignOut();
    disconnectClientRealtime();
    setState({ user: null, status: 'unauthenticated' });
  }, []);

  return { ...state, reload, login, logout };
}
