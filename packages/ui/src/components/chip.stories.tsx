import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

import { Button } from './button';
import { Chip } from './chip';

const meta = {
  title: 'Design system/Actions/Chip',
  component: Chip,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { children: 'Ready' },
} satisfies Meta<typeof Chip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

const statuses = ['All', 'Ready', 'Processing', 'Failed'] as const;

function StatusFilterDemo() {
  const [active, setActive] = useState<string>('All');
  return (
    <div
      aria-label="Filter imports by status"
      className="flex gap-2"
      role="group"
    >
      {statuses.map((status) => (
        <Chip
          key={status}
          onClick={() => setActive(status)}
          pressed={active === status}
        >
          {status}
        </Chip>
      ))}
    </div>
  );
}

export const StatusFilter: Story = {
  render: () => <StatusFilterDemo />,
};

export const Suggestions: Story = {
  render: () => (
    <div aria-label="Topic suggestions" className="flex flex-wrap gap-2">
      {['A weekend in Bergen', 'Ordering at a bakery', 'Moving flats'].map(
        (topic) => (
          <Chip key={topic} variant="suggestion">
            {topic}
          </Chip>
        ),
      )}
    </div>
  ),
};

export const AppliedQuery: Story = {
  args: {
    'aria-label': 'Clear search "hus"',
    children: '"hus"',
    removable: true,
  },
};

/** Shape carries meaning: rounded acts, pill narrows or seeds. */
export const ChipBesideButton: Story = {
  render: () => (
    <div className="grid max-w-md gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip pressed>Due today</Chip>
        <Chip pressed={false}>New</Chip>
        <Chip pressed={false}>Learning</Chip>
      </div>
      <div className="flex gap-2">
        <Button>Start review</Button>
        <Button variant="outline">Browse deck</Button>
      </div>
    </div>
  ),
};

export const States: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Chip>Resting</Chip>
      <Chip pressed>Pressed</Chip>
      <Chip variant="suggestion">Suggestion</Chip>
      <Chip disabled>Disabled</Chip>
    </div>
  ),
};
