import type { Meta, StoryObj } from '@storybook/react';
import { Bolt, List, Star } from 'lucide-react';

import { Card } from './card';
import { Heading } from './heading';
import { IconWell } from './icon-well';

const meta = {
  title: 'Design system/Surfaces/Icon well',
  component: IconWell,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof IconWell>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  args: { icon: Bolt, tone: 'brand' },
};

export const Tones: Story = {
  render: () => (
    <div className="w-88">
      <Card padding="default">
        <Heading as="div" size="xxsmall" tone="subtle">
          Field wells
        </Heading>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <IconWell tone="brand" icon={Bolt} />
          <IconWell tone="neutral" icon={List} />
          <IconWell tone="success" icon={Star} />
        </div>
      </Card>
    </div>
  ),
};

export const ShapesAndSizes: Story = {
  render: () => (
    <div className="w-88">
      <Card padding="default">
        <Heading as="div" size="xxsmall" tone="subtle">
          Circle wells
        </Heading>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <IconWell shape="circle" size="sm" tone="neutral" icon={Bolt} />
          <IconWell shape="circle" size="md" tone="brand" icon={List} />
          <IconWell shape="circle" size="lg" tone="success" icon={Star} />
        </div>
        <div className="mt-4">
          <Heading as="div" size="xxsmall" tone="subtle">
            Field wells
          </Heading>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <IconWell size="sm" tone="neutral" icon={Bolt} />
          <IconWell size="md" tone="brand" icon={List} />
          <IconWell size="lg" tone="success" icon={Star} />
        </div>
      </Card>
    </div>
  ),
};

/** Without the icon prop the well frames whatever the caller renders. */
export const ChildrenMode: Story = {
  render: () => (
    <div className="w-88">
      <Card padding="default">
        <div className="grid grid-cols-3 gap-3">
          <IconWell tone="brand">
            <Bolt className="icon-md" />
          </IconWell>
          <IconWell tone="neutral">
            <List className="icon-md" />
          </IconWell>
          <IconWell tone="success">
            <Star className="icon-md" />
          </IconWell>
        </div>
      </Card>
    </div>
  ),
};
