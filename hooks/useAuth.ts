'use client';

/**
 * useAuth Hook
 * Convenient hook for accessing authentication state and methods
 */

import { useAuthContext } from '@/lib/auth-context';

export function useAuth() {
  return useAuthContext();
}

export default useAuth;
