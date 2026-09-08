export type DraftStorageStatus = 'saved' | 'unavailable';
export type DraftRemovalStatus = 'removed' | 'unavailable';

export function readDraft(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function saveDraft(key: string, value: string): DraftStorageStatus {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return 'unavailable';
    storage.setItem(key, value);
    return 'saved';
  } catch {
    return 'unavailable';
  }
}

export function removeDraft(key: string): DraftRemovalStatus {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return 'unavailable';
    storage.removeItem(key);
    return 'removed';
  } catch {
    return 'unavailable';
  }
}
