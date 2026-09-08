import { DndContext } from '@dnd-kit/core';
import type { Meta, StoryObj } from '@storybook/react';

import { DropZone } from './DropZone';

const meta = {
  title: 'Flashcard/DropZone',
  component: DropZone,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <DndContext>
        <div className="flex flex-wrap items-center gap-4 p-4">
          <Story />
        </div>
      </DndContext>
    ),
  ],
  args: {
    id: 'zone-1',
    label: 'Common gender',
  },
  argTypes: {
    id: { control: 'text' },
    label: { control: 'text' },
    isOver: { control: 'boolean' },
  },
} satisfies Meta<typeof DropZone>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  args: { isOver: false },
};

export const Highlighted: Story = {
  args: { isOver: true },
  render: (args) => (
    <DropZone {...args} className="w-64">
      <span className="radius-field border border-border bg-card px-4 py-3 text-base font-semibold">
        en bok
      </span>
    </DropZone>
  ),
};

export const EmptyNoLabel: Story = {
  args: { label: undefined, isOver: false },
};

export const WithChips: Story = {
  render: () => (
    <DropZone id="bucket-1" label="Neuter" className="w-64">
      <span className="radius-field border border-border bg-card px-4 py-3 text-base font-semibold">
        et hus
      </span>
      <span className="radius-field border border-border bg-card px-4 py-3 text-base font-semibold">
        ett eple
      </span>
    </DropZone>
  ),
};
