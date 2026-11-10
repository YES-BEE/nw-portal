export interface RegisteredTag {
  id: string;
  name: string;
  actual: string;
}

export const TAG_STORAGE_KEY = 'nw-track-tags-v2';

export function loadTags(): {
  records: RegisteredTag[];
  storageUnavailable: boolean;
} {
  try {
    const stored: unknown = JSON.parse(
      localStorage.getItem(TAG_STORAGE_KEY) ?? 'null',
    );
    if (
      Array.isArray(stored) &&
      stored.every((value: unknown) => {
        if (typeof value !== 'object' || value === null) return false;
        const tag = value as Record<string, unknown>;
        return typeof tag.name === 'string' && typeof tag.actual === 'string';
      })
    ) {
      return {
        records: stored.map(
          (tag: { id?: unknown; name: string; actual: string }, index) => ({
            name: tag.name,
            actual: tag.actual,
            id:
              typeof tag.id === 'string' && tag.id
                ? tag.id
                : `tag-${index + 1}`,
          }),
        ),
        storageUnavailable: false,
      };
    }
    return {
      records: [],
      storageUnavailable: stored !== null,
    };
  } catch {
    return { records: [], storageUnavailable: true };
  }
}
