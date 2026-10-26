import { Text } from '@flyt/ui';
import type { Meta, StoryObj } from '@storybook/react';

import { WordSpan } from './WordSpan';

const meta = {
  title: 'Features/Reading/WordSpan',
  component: WordSpan,
  parameters: { layout: 'padded' },
  args: { text: 'huset', state: 'new', isInteractive: true },
} satisfies Meta<typeof WordSpan>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReadingStates: Story = {
  render: () => (
    <div className="space-y-5">
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Text as="span" size="fluid">
          <WordSpan isInteractive state="new" text="huset" />
        </Text>
        <Text as="span" size="fluid">
          <WordSpan isInteractive state="learning" text="hunden" />
        </Text>
        <Text as="span" size="fluid">
          <WordSpan isInteractive state="mastered" text="boken" />
        </Text>
        <Text as="span" size="fluid">
          <WordSpan current isInteractive state="new" text="kaffe" />
        </Text>
        <Text as="span" size="fluid">
          <WordSpan hasLemma={false} isInteractive state="new" text="og" />
        </Text>
        <Text as="span" size="fluid">
          <WordSpan isInteractive={false} state="new" text="på" />
        </Text>
      </p>
      <Text size="fluid" lang="nb">
        Hun kjøper <WordSpan isInteractive state="new" text="melk," />{' '}
        <WordSpan isInteractive state="learning" text="brød" /> og{' '}
        <WordSpan isInteractive state="mastered" text="epler." />
      </Text>
    </div>
  ),
};
