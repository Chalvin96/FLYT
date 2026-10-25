import { Text } from '@flyt/ui';
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
        'border-default bg-raised text-subtle hover:bg-neutral-subtle hover:text-default',
        'size-10 rounded-full',
        'lg:h-9 lg:w-72 lg:justify-start lg:radius-field lg:px-3',
        className,
      )}
    >
      <Search className="icon-sm shrink-0" strokeWidth={1.9} />
      <span className="hidden flex-1 items-center justify-between lg:flex">
        <span className="flex whitespace-nowrap">
          <Text as="span" size="medium">
            Look up a word…
          </Text>
        </span>
        <span className="flex opacity-40">
          <Text as="span" size="small">
            {isMac ? '⌘K' : 'Ctrl+K'}
          </Text>
        </span>
      </span>
    </button>
  );
}
