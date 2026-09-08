import { useCallback, useSyncExternalStore } from 'react';

const DESKTOP_BREAKPOINT = 1024;

function getMatches(query: string): boolean {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return false;
  }
  return window.matchMedia(query).matches;
}

function subscribe(query: string, callback: () => void) {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return () => {};
  }
  const mql = window.matchMedia(query);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

export function useIsDesktop(breakpoint = DESKTOP_BREAKPOINT): boolean {
  const query = `(min-width: ${breakpoint}px)`;
  const getSnapshot = useCallback(() => getMatches(query), [query]);
  const getServerSnapshot = useCallback(() => false, []);
  const subscribeQuery = useCallback(
    (callback: () => void) => subscribe(query, callback),
    [query],
  );
  return useSyncExternalStore(subscribeQuery, getSnapshot, getServerSnapshot);
}
