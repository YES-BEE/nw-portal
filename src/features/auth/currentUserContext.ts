import { createContext, useContext } from 'react';
import type { MeResponse } from './types';

export const CurrentUserContext = createContext<MeResponse | null>(null);

export function useCurrentUser() {
  return useContext(CurrentUserContext);
}
