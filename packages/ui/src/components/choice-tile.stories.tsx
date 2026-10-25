import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

import { Badge } from './badge';
import { ChoiceTile } from './choice-tile';
import { Heading } from './heading';
import { Text } from './text';

const meta = {
  title: 'Design system/Actions/Choice Tile',
  component: ChoiceTile,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { children: '20 cards' },
} satisfies Meta<typeof ChoiceTile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

const lengths = ['10 cards', '20 cards', '40 cards'] as const;

function SessionLengthDemo() {
  const [picked, setPicked] = useState<string>('20 cards');
  return (
    <div aria-label="Session length" className="flex gap-3" role="radiogroup">
      {lengths.map((length) => (
        <ChoiceTile
          key={length}
          onClick={() => setPicked(length)}
          selected={picked === length}
          tabIndex={picked === length ? 0 : -1}
        >
          <Heading as="div" size="medium">
            {length}
          </Heading>
          <Text size="medium" tone={picked === length ? 'default' : 'subtle'}>
            ~3 min session
          </Text>
        </ChoiceTile>
      ))}
    </div>
  );
}

export const SessionLength: Story = {
  render: () => <SessionLengthDemo />,
};

/** A row choice carries a label, a reason, and an optional status badge. */
export const Rows: Story = {
  render: () => (
    <div
      aria-label="Story focus"
      className="grid max-w-md gap-2"
      role="radiogroup"
    >
      <ChoiceTile layout="row" selected tabIndex={0}>
        <Text as="span" size="large" weight="semibold">
          Words due today
        </Text>
        <Text as="span" size="medium" tone="default">
          Builds the story from the cards you are about to review.
        </Text>
      </ChoiceTile>
      <ChoiceTile layout="row" selected={false} tabIndex={-1}>
        <Text as="span" size="large" weight="semibold">
          Whole deck
        </Text>
        <Text as="span" size="medium" tone="subtle">
          Draws on every word you have saved.
        </Text>
      </ChoiceTile>
      <ChoiceTile layout="row" selected={false} tabIndex={-1} unavailable>
        <span className="flex items-center justify-between gap-3">
          <Text as="span" size="large" weight="semibold">
            Neuter nouns
          </Text>
          <Badge tone="warning">Unavailable</Badge>
        </span>
        <Text as="span" size="medium">
          Needs at least 20 words to unlock.
        </Text>
      </ChoiceTile>
    </div>
  ),
};

export const Inline: Story = {
  render: () => (
    <div
      aria-label="Story length"
      className="flex max-w-md gap-2"
      role="radiogroup"
    >
      <ChoiceTile layout="inline" selected tabIndex={0}>
        Short
      </ChoiceTile>
      <ChoiceTile layout="inline" selected={false} tabIndex={-1}>
        Medium
      </ChoiceTile>
      <ChoiceTile layout="inline" selected={false} tabIndex={-1}>
        Long
      </ChoiceTile>
    </div>
  ),
};

export const States: Story = {
  render: () => (
    <div className="flex flex-wrap items-start gap-3">
      <ChoiceTile layout="inline" selected={false}>
        Resting
      </ChoiceTile>
      <ChoiceTile announceAs="toggle" layout="inline" selected>
        Selected
      </ChoiceTile>
      <ChoiceTile layout="inline" selected={false} unavailable>
        Unavailable
      </ChoiceTile>
      <ChoiceTile disabled layout="inline" selected={false}>
        Disabled
      </ChoiceTile>
    </div>
  ),
};
