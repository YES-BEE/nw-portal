import { useEffect, useSyncExternalStore } from 'react';
import {
  getSessionSnapshot,
  readSession,
  signOut,
  subscribeSession,
} from './session';

export function useSession() {
  useSyncExternalStore(subscribeSession, getSessionSnapshot);
  const session = readSession();
  const authenticated = session !== null;
  useEffect(() => {
    if (!authenticated) signOut();
  }, [authenticated]);
  return session;
}
