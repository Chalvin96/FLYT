import type { Meta, StoryObj } from '@storybook/react';

import { GrammarTagBadge } from './GrammarTagBadge';

const meta = {
  title: 'Common/GrammarTagBadge',
  component: GrammarTagBadge,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof GrammarTagBadge>;
export default meta;

type Story = StoryObj<typeof meta>;

export const NounGender: Story = {
  args: {
    label: 'Masculine',
  },
};
export const VerbClass: Story = {
  args: {
    label: '-et class',
  },
};
