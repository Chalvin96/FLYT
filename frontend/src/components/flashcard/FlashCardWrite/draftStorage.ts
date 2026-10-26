export type DraftStorageStatus = 'saved' | 'unavailable';
export type DraftRemovalStatus = 'removed' | 'unavailable';

export function readDraft(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function readDraftMigratingLegacy(
  key: string,
  legacyKey?: string,
): string | null {
  const current = readDraft(key);
  if (current || !legacyKey) return current;

  const legacy = readDraft(legacyKey);
  if (legacy === null) return current;

  if (saveDraft(key, legacy) === 'saved') {
    removeDraft(legacyKey);
  }
  return legacy;
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

export function removeDraftAndLegacy(
  key: string,
  legacyKey?: string,
): DraftRemovalStatus {
  const current = removeDraft(key);
  const legacy = legacyKey ? removeDraft(legacyKey) : 'removed';
  return current === 'removed' && legacy === 'removed'
    ? 'removed'
    : 'unavailable';
}
