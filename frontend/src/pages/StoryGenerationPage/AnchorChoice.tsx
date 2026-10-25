import { Badge, ChoiceTile, Text } from '@flyt/ui';

import type { StoryGenerationAnchor } from '@/types/api';

import { ANCHOR_COPY } from './constants';

export function AnchorChoice({
  anchor,
  selected,
  tabStop,
  onSelect,
  minDeckSize,
}: {
  anchor: StoryGenerationAnchor;
  selected: boolean;
  tabStop: boolean;
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
    <ChoiceTile
      layout="row"
      onClick={onSelect}

      selected={selected}
      tabIndex={tabStop ? 0 : -1}
      unavailable={!anchor.available}
    >
      <span className="flex items-center justify-between gap-3">
        <Text as="span" size="large" weight="semibold" tone="default">
          {copy.label}
        </Text>
        {!anchor.available ? <Badge tone="neutral">Unavailable</Badge> : null}
      </span>
      <Text
        as="span"
        size="medium"
        tone={selected && anchor.available ? 'default' : 'subtle'}
      >
        {reason ?? copy.description}
      </Text>
    </ChoiceTile>
  );
}
