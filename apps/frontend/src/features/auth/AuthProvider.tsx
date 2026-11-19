import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { AuthContext } from '@/features/auth/useAuth';
import type { AuthUser } from '@/features/auth/types';

export interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: () => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setSessionUser: (nextUser: AuthUser | null) => void;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshSeqRef = useRef(0);

  const setSessionUser = useCallback((nextUser: AuthUser | null) => {
    refreshSeqRef.current += 1;
    setUser(nextUser);
    setError(null);
    setLoading(false);
  }, []);

  const refresh = useCallback(async (retryCount = 0, seq?: number) => {
    const currentSeq = seq ?? ++refreshSeqRef.current;
    if (retryCount === 0) {
      setLoading(true);
    }
    try {
      const res = await api<{ data: AuthUser }>('/auth/me');
      if (currentSeq !== refreshSeqRef.current) return;
      setUser(res.data);
      setError(null);
    } catch (err) {
      if (currentSeq !== refreshSeqRef.current) return;
      // Retry once after a short delay to handle cookie race condition
      if (retryCount < 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
        if (currentSeq !== refreshSeqRef.current) return;
        await refresh(retryCount + 1, currentSeq);
        return;
      }
      setUser(null);
      setError(err instanceof Error ? err.message : 'Sesi tidak valid');
    } finally {
      if (retryCount === 0 && currentSeq === refreshSeqRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (window.location.pathname.startsWith('/auth/callback') && params.has('ticket')) {
      return;
    }
    void refresh();
  }, [refresh]);

  const login = useCallback(() => {
    window.location.href = '/api/v1/auth/login';
  }, []);

  const logout = useCallback(async () => {
    try {
      const res = await api<{ data: { logoutUrl?: string } }>('/auth/logout', { method: 'POST' });
      setUser(null);
      window.location.replace(res.data?.logoutUrl ?? '/login');
    } catch {
      setUser(null);
      window.location.replace('/login');
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, error, login, logout, refresh, setSessionUser }),
    [user, loading, error, login, logout, refresh, setSessionUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

