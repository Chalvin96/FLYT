import { Badge } from '@flyt/ui';

import { cn } from '@/lib/utils';
import type { StoryGenerationAnchor } from '@/types/api';

import { ANCHOR_COPY } from './constants';

export function AnchorChoice({
  anchor,
  selected,
  onSelect,
  minDeckSize,
}: {
  anchor: StoryGenerationAnchor;
  selected: boolean;
  onSelect: () => void;
  minDeckSize: number;
}) {
  const copy = ANCHOR_COPY[anchor.type] ?? {
    label: anchor.type,
    description: 'Vocabulary chosen by Flyt',
  };
  const reason = anchor.available
    ? null
    : anchor.reason === 'deck_below_minimum'
      ? `Needs at least ${minDeckSize} words to unlock.`
      : 'This focus is unavailable right now.';

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={!anchor.available}
      tabIndex={selected ? 0 : -1}
      onClick={() => {
        if (anchor.available) onSelect();
      }}
      className={cn(
        'flex w-full flex-col gap-1 radius-field border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected
          ? 'border-primary-70 bg-primary-10 shadow-inset'
          : 'border-border bg-white-100 hover:border-secondary-30 hover:bg-secondary-10',
        !anchor.available &&
          'cursor-not-allowed border-secondary-20 bg-secondary-10/60 text-muted-foreground opacity-80 hover:border-secondary-20 hover:bg-secondary-10/60',
      )}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="type-body font-semibold text-foreground">
          {copy.label}
        </span>
        {!anchor.available ? (
          <Badge
            variant="outline"
            className="shrink-0 border-warning-30 bg-warning-10 type-caption-sm text-warning-80"
          >
            Unavailable
          </Badge>
        ) : null}
      </span>
      <span className="type-caption text-muted-foreground">
        {reason ?? copy.description}
      </span>
    </button>
  );
}
