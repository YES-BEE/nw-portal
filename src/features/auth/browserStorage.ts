const cleanupKey = 'nw-track-storage-cleanup-v1';

// Clear records from the browser-only prototype once per storage area.
// New authenticated sessions use a separate key and are retained.
export function clearDemoStorage() {
  for (const area of ['localStorage', 'sessionStorage'] as const) {
    try {
      const storage = window[area];
      if (storage.getItem(cleanupKey) === 'done') continue;
      const keys = Array.from({ length: storage.length }, (_, index) =>
        storage.key(index),
      );
      for (const key of keys) {
        if (
          key &&
          (/^nw-track-(?:access|process-config|storages|tags|styles|demo-styles)-v\d+$/.test(
            key,
          ) ||
            key === 'nw-track-session-v1')
        )
          storage.removeItem(key);
      }
      storage.setItem(cleanupKey, 'done');
    } catch {
      // A blocked storage area must not prevent the login screen from loading.
    }
  }
}
