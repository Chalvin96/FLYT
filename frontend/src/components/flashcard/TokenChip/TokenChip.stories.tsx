import type { Meta, StoryObj } from '@storybook/react';

import { TokenChip, type TokenChipState } from './TokenChip';

const meta = {
  title: 'Flashcard/TokenChip',
  component: TokenChip,
  tags: ['autodocs'],
  argTypes: {
    text: { control: 'text', description: 'Word or phrase in the chip' },
    state: {
      control: 'select',
      options: [
        'idle',
        'selected',
        'dragging',
        'correct',
        'wrong',
        'fixed',
      ] satisfies TokenChipState[],
      description: 'Visual + interactive state',
    },
    onClick: { action: 'onClick' },
    disabled: { control: 'boolean' },
  },
  decorators: [
    (Story) => (
      <div className="flex flex-wrap items-center gap-2 p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    text: 'snakker',
    state: 'idle',
  },
} satisfies Meta<typeof TokenChip>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  args: { state: 'idle' },
};

export const Selected: Story = {
  args: { state: 'selected' },
};

export const Dragging: Story = {
  args: { state: 'dragging' },
};

export const Correct: Story = {
  args: { state: 'correct' },
};

export const Wrong: Story = {
  args: { state: 'wrong' },
};

export const Fixed: Story = {
  args: { state: 'fixed' },
};

export const Disabled: Story = {
  args: { state: 'idle', disabled: true },
};

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <TokenChip text="Jeg" state="idle" />
      <TokenChip text="snakker" state="selected" />
      <TokenChip text="norsk" state="dragging" />
      <TokenChip text="hver" state="correct" />
      <TokenChip text="dag" state="wrong" />
      <TokenChip text="," state="fixed" />
    </div>
  ),
};
