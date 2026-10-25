import { CHATBOT_OPEN_STATES } from './types';

const RAIL_PREFERENCE_PREFIX = 'flyt.chatbot.rail-preference';

function buildStorageKey(accountId: string): string {
  return `${RAIL_PREFERENCE_PREFIX}:${accountId}`;
}

function readStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadRailPreference(
  accountId: string | number | null | undefined,
): boolean | null {
  if (accountId === null || accountId === undefined) return null;
  const storage = readStorage();
  if (!storage) return null;

  try {
    const value = storage.getItem(buildStorageKey(String(accountId)));
    if (value === CHATBOT_OPEN_STATES.OPEN) return true;
    if (value === CHATBOT_OPEN_STATES.CLOSED) return false;
    return null;
  } catch {
    return null;
  }
}

export function writeRailPreference(
  accountId: string | number | null | undefined,
  open: boolean,
): void {
  if (accountId === null || accountId === undefined) return;
  const storage = readStorage();
  if (!storage) return;

  try {
    storage.setItem(
      buildStorageKey(String(accountId)),
      open ? CHATBOT_OPEN_STATES.OPEN : CHATBOT_OPEN_STATES.CLOSED,
    );
  } catch {
    /* Preference is best-effort; private mode may reject writes. */
  }
}
