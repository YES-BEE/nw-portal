export interface RegisteredTag {
  id: string;
  name: string;
  actual: string;
}

export const TAG_STORAGE_KEY = 'nw-track-tags-v1';

export const defaultTags: RegisteredTag[] = [
  { name: 'Lot Preparation Tag', actual: 'NFC-PROC-001' },
  { name: 'Washer 01 Tag', actual: 'NFC-DEV-001' },
  { name: 'Washer 02 Tag', actual: 'NFC-DEV-002' },
  { name: 'Storage Bay A Tag', actual: 'NFC-STORE-001' },
  { name: 'Storage Bay B Tag', actual: 'NFC-STORE-002' },
  { name: 'Storage Bay C Tag', actual: 'NFC-STORE-003' },
  { name: 'Finishing Line Tag', actual: 'NFC-PROC-002' },
  { name: 'Finisher 01 Tag', actual: 'NFC-DEV-003' },
  { name: 'Finisher 02 Tag', actual: 'NFC-DEV-004' },
].map((tag, index) => ({ ...tag, id: `tag-${index + 1}` }));

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
      records: structuredClone(defaultTags),
      storageUnavailable: stored !== null,
    };
  } catch {
    return { records: structuredClone(defaultTags), storageUnavailable: true };
  }
}
