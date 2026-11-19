import { createContext, useContext } from 'react';
import type { AuthState } from '@/features/auth/AuthProvider';

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth harus dipakai di dalam AuthProvider');
  }
  return context;
}
