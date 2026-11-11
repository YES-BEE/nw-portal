import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getStorageTags } from './storagesApi';
export function useStorageTagName(enabled: boolean) {
  const { t } = useTranslation('translation');
  const [names, setNames] = useState(new Map<string, string>());
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void getStorageTags(controller.signal).then(
      (tags) => {
        if (!controller.signal.aborted)
          setNames(
            new Map(tags.map((tag) => [tag.uid.toUpperCase(), tag.name])),
          );
      },
      () => {
        /* Keep the readable fallback when lookup names are unavailable. */
      },
    );
    return () => controller.abort();
  }, [enabled]);
  return (uid: string | null) =>
    uid
      ? names.get(uid.toUpperCase()) || t('tags.nameUnavailable')
      : t('storages.noTag');
}
