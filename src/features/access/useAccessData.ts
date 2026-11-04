import { useState } from 'react';
import { ACCESS_STORAGE_KEY, isAccessData, loadAccessData } from './accessData';
import type { AccessData } from './accessData';
import { notifySessionChange } from '../auth/session';

export function useAccessData() {
  const [data, setData] = useState(loadAccessData);
  const [error, setError] = useState<'storageError' | 'roleAssigned' | null>(
    null,
  );

  function persist(update: (latest: AccessData) => AccessData | null) {
    try {
      const records = update(loadAccessData().records);
      if (!records || !isAccessData(records)) {
        setError('roleAssigned');
        return false;
      }
      localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(records));
      notifySessionChange();
      setData({ records, unavailable: false });
      setError(null);
      return true;
    } catch {
      setError('storageError');
      return false;
    }
  }
  return { data, error, persist, setError };
}
