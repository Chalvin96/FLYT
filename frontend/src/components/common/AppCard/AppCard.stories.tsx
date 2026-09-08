import type { Meta, StoryObj } from '@storybook/react';

import { AppCard } from './AppCard';

const meta = {
  title: 'Common/AppCard',
  component: AppCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof AppCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <AppCard className="w-80 p-4">
      <p className="text-sm text-muted-foreground">Card content goes here.</p>
    </AppCard>
  ),
};
