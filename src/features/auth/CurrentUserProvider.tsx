import { useMemo, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { CurrentUserContext } from './currentUserContext';
import { getSessionSnapshot, subscribeSession } from './session';
import type { AuthSession } from './session';

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(subscribeSession, getSessionSnapshot);
  const profile = useMemo(() => {
    const session = JSON.parse(snapshot) as AuthSession | null;
    return session?.profile ?? null;
  }, [snapshot]);
  return (
    <CurrentUserContext.Provider value={profile}>
      {children}
    </CurrentUserContext.Provider>
  );
}
