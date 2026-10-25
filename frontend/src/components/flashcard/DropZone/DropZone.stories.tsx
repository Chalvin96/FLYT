import { DndContext } from '@dnd-kit/core';
import { Text } from '@flyt/ui';
import type { Meta, StoryObj } from '@storybook/react';

import { DropZone } from './DropZone';

const chipClassName = 'radius-field border border-default bg-raised px-4 py-3';

const meta = {
  title: 'Features/Flashcard/DropZone',
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
      <span className={chipClassName}>
        <Text as="span" size="large" weight="semibold">
          en bok
        </Text>
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
      <span className={chipClassName}>
        <Text as="span" size="large" weight="semibold">
          et hus
        </Text>
      </span>
      <span className={chipClassName}>
        <Text as="span" size="large" weight="semibold">
          ett eple
        </Text>
      </span>
    </DropZone>
  ),
};
