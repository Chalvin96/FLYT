import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouterState } from '@tanstack/react-router';

import {
  initialLookupState,
  lookupContext,
  type LookupContextValue,
  type LookupState,
} from './LookupContext';

export function LookupProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LookupState>(initialLookupState);

  const openLemma = useCallback(
    (lemmaUuid: string | null, wordText: string) => {
      setState((s) => ({
        ...s,
        isOpen: true,
        mode: 'lemma',
        lemmaTarget: { lemmaUuid, wordText },
        priorQuery: null,
      }));
    },
    [],
  );

  const openSearch = useCallback((query?: string) => {
    setState((s) => ({
      ...s,
      isOpen: true,
      mode: 'search',
      searchQuery: query ?? s.searchQuery,
    }));
  }, []);

  const switchToLemma = useCallback(
    (lemmaUuid: string | null, wordText: string) => {
      setState((s) => ({
        ...s,
        mode: 'lemma',
        lemmaTarget: { lemmaUuid, wordText },
        priorQuery: s.mode === 'search' ? s.searchQuery : s.priorQuery,
      }));
    },
    [],
  );

  const switchToSearch = useCallback(() => {
    setState((s) => ({
      ...s,
      mode: 'search',
      searchQuery: s.priorQuery ?? s.searchQuery,
    }));
  }, []);

  const close = useCallback(() => {
    setState((s) => ({ ...s, isOpen: false }));
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setState((s) => ({ ...s, searchQuery: query }));
  }, []);

  // Auto-close on route change.
  const location = useRouterState({
    select: (s) => ({
      pathname: s.location.pathname,
      search: s.location.search,
    }),
  });
  const previousPathnameRef = useRef(location.pathname);
  useEffect(() => {
    const previousPathname = previousPathnameRef.current;
    previousPathnameRef.current = location.pathname;

    if (previousPathname === location.pathname) {
      return;
    }

    if (
      location.pathname === '/home' &&
      typeof (location.search as { lookup?: unknown }).lookup === 'string'
    ) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    close();
  }, [location.pathname, location.search, close]);

  const value = useMemo<LookupContextValue>(
    () => ({
      ...state,
      openLemma,
      openSearch,
      switchToLemma,
      switchToSearch,
      close,
      setSearchQuery,
    }),
    [
      state,
      openLemma,
      openSearch,
      switchToLemma,
      switchToSearch,
      close,
      setSearchQuery,
    ],
  );

  return (
    <lookupContext.Provider value={value}>{children}</lookupContext.Provider>
  );
}
