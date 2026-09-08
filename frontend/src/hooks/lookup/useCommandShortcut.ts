import { useEffect } from 'react';

import { useLookupContext } from '@/components/lookup/useLookupContext';

export function useCommandShortcut(): void {
  const { openSearch } = useLookupContext();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isMeta = event.metaKey || event.ctrlKey;
      const isK = event.key === 'k' || event.key === 'K';

      if (!isMeta || !isK) return;

      const activeElement = document.activeElement as HTMLElement;
      const isInput =
        activeElement?.tagName === 'INPUT' ||
        activeElement?.tagName === 'TEXTAREA';

      if (isInput) return;

      event.preventDefault();
      openSearch();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [openSearch]);
}
