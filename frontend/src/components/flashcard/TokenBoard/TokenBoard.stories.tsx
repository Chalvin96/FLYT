import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

import { TokenBoard } from './TokenBoard';

const TOKENS = [
  { token_id: 'jeg', text: 'Jeg', fixed: true },
  { token_id: 'snakker', text: 'snakker', fixed: false },
  { token_id: 'ikke', text: 'ikke', fixed: false },
  { token_id: 'norsk', text: 'norsk', fixed: false },
  { token_id: 'enn', text: 'enn', fixed: false },
];

const ANSWER_ORDER = ['jeg', 'snakker', 'ikke', 'norsk', 'enn'];
const MOVABLE_ANSWER_ORDER = ['snakker', 'ikke', 'norsk', 'enn'];

const meta = {
  title: 'Flashcard/TokenBoard',
  component: TokenBoard,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="flex flex-col gap-4 p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    tokens: TOKENS,
    answerOrder: ANSWER_ORDER,
    selectedTokenIds: [null, null, null, null],
    movableAnswerOrder: MOVABLE_ANSWER_ORDER,
    onAdd: () => {},
    onMoveToSlot: () => {},
    onRemove: () => {},
  },
  argTypes: {
    onAdd: { action: 'onAdd' },
    onMoveToSlot: { action: 'onMoveToSlot' },
    onRemove: { action: 'onRemove' },
  },
} satisfies Meta<typeof TokenBoard>;
export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Interactive story — click bank chips to build the sentence, click placed
 * chips to return them. Demonstrates the motion layoutId flight.
 */
function TokenBoardHarness() {
  const [selected, setSelected] = useState<(string | null)[]>(() =>
    MOVABLE_ANSWER_ORDER.map(() => null),
  );
  return (
    <TokenBoard
      tokens={TOKENS}
      answerOrder={ANSWER_ORDER}
      selectedTokenIds={selected}
      movableAnswerOrder={MOVABLE_ANSWER_ORDER}
      onAdd={(id) =>
        setSelected((curr) => {
          const idx = curr.indexOf(null);
          if (idx === -1) return curr;
          const next = [...curr];
          next[idx] = id;
          return next;
        })
      }
      onMoveToSlot={(tokenId, slotIndex) =>
        setSelected((curr) => {
          const next = [...curr];
          const sourceIdx = curr.indexOf(tokenId);
          const occupant = next[slotIndex];
          if (sourceIdx !== -1 && sourceIdx !== slotIndex) {
            next[sourceIdx] = occupant;
            next[slotIndex] = tokenId;
          } else if (sourceIdx === -1) {
            next[slotIndex] = tokenId;
          }
          return next;
        })
      }
      onRemove={(slotIndex) =>
        setSelected((curr) => {
          const next = [...curr];
          next[slotIndex] = null;
          return next;
        })
      }
    />
  );
}

export const Interactive: Story = {
  render: () => <TokenBoardHarness />,
};

export const Empty: Story = {};

export const PartiallyFilled: Story = {
  args: { selectedTokenIds: ['snakker', null, null, null] },
};

export const FullyFilled: Story = {
  args: { selectedTokenIds: ['snakker', 'ikke', 'norsk', 'enn'] },
};

export const ResultCorrect: Story = {
  args: {
    selectedTokenIds: ['snakker', 'ikke', 'norsk', 'enn'],
    result: { correct: true },
  },
};

export const ResultWrong: Story = {
  args: {
    selectedTokenIds: ['ikke', 'snakker', 'norsk', 'enn'],
    result: { correct: false },
  },
};

export const Disabled: Story = {
  args: {
    selectedTokenIds: ['snakker', 'ikke', 'norsk', 'enn'],
    disabled: true,
    result: { correct: true },
  },
};
