import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getProcessTags } from './processesApi';

export function useTagName(enabled: boolean) {
  const { t } = useTranslation('translation');
  const [names, setNames] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void getProcessTags(controller.signal).then(
      (tags) => {
        if (!controller.signal.aborted)
          setNames(
            new Map(tags.map((tag) => [tag.uid.toUpperCase(), tag.name])),
          );
      },
      () => {
        /* Missing names use the display fallback; never expose raw UIDs. */
      },
    );
    return () => controller.abort();
  }, [enabled]);
  return (uid: string | null) =>
    uid
      ? names.get(uid.toUpperCase()) || t('tags.nameUnavailable')
      : t('processes.noTag');
}
