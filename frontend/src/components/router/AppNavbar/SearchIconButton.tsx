import { Search } from 'lucide-react';

import { useLookupContext } from '@/components/lookup/useLookupContext';
import { cn } from '@/lib/utils';

const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(
    (navigator as { userAgentData?: { platform?: string } }).userAgentData
      ?.platform ?? navigator.userAgent,
  );

export function SearchIconButton({ className }: { className?: string }) {
  const { openSearch } = useLookupContext();

  return (
    <button
      type="button"
      onClick={() => openSearch()}
      aria-label="Search dictionary"
      aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}
      className={cn(
        'inline-flex cursor-pointer items-center justify-center gap-2 border transition-colors',
        'border-border bg-card text-muted-foreground hover:bg-secondary-10 hover:text-foreground',
        // Mobile: circle matching avatar
        'size-10 rounded-full',
        // Desktop: input shape matching other search fields in the app
        'lg:h-9 lg:w-72 lg:justify-start lg:radius-field lg:px-3',
        className,
      )}
    >
      <Search className="icon-sm shrink-0" strokeWidth={1.9} />
      <span className="hidden flex-1 items-center justify-between lg:flex">
        <span className="whitespace-nowrap type-caption">Look up a word…</span>
        <span className="type-caption-sm opacity-40">
          {isMac ? '⌘K' : 'Ctrl+K'}
        </span>
      </span>
    </button>
  );
}
