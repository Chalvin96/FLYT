import type { Meta, StoryObj } from '@storybook/react';
import { Bolt, List, Star, TriangleAlert } from 'lucide-react';

import { AppCard } from '../AppCard/AppCard';
import { IconWell } from './IconWell';

const meta = {
  title: 'Common/IconWell',
  component: IconWell,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof IconWell>;

export default meta;

type Story = StoryObj<typeof meta>;

export const IconPropMode: Story = {
  render: () => (
    <AppCard className="story-preview-width p-5">
      <p className="type-label text-muted-foreground">Icon prop mode</p>
      <div className="mt-4 grid grid-cols-4 gap-3">
        <IconWell tone="primary" icon={Bolt} />
        <IconWell tone="secondary" icon={List} />
        <IconWell tone="accent" icon={Star} />
        <IconWell tone="warning" icon={TriangleAlert} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <IconWell
          shape="circle"
          size="sm"
          className="bg-primary-70 text-white-100"
          icon={Bolt}
        />
        <IconWell
          shape="circle"
          size="md"
          className="bg-secondary-60 text-white-100"
          icon={List}
        />
        <IconWell
          shape="circle"
          size="lg"
          className="bg-warning-50 text-secondary-100"
          icon={TriangleAlert}
        />
      </div>
    </AppCard>
  ),
};

export const ChildrenMode: Story = {
  render: () => (
    <AppCard className="story-preview-width p-5">
      <p className="type-label text-muted-foreground">Children mode</p>
      <div className="mt-4 grid grid-cols-4 gap-3">
        <IconWell tone="primary">
          <Bolt className="icon-md" />
        </IconWell>
        <IconWell tone="secondary">
          <List className="icon-md" />
        </IconWell>
        <IconWell tone="accent">
          <Star className="icon-md" />
        </IconWell>
        <IconWell tone="warning">
          <TriangleAlert className="icon-md" />
        </IconWell>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <IconWell
          shape="circle"
          size="sm"
          className="bg-primary-70 text-white-100"
        >
          <Bolt className="icon-sm" />
        </IconWell>
        <IconWell
          shape="circle"
          size="md"
          className="bg-secondary-60 text-white-100"
        >
          <List className="icon-md" />
        </IconWell>
        <IconWell
          shape="circle"
          size="lg"
          className="bg-warning-50 text-secondary-100"
        >
          <TriangleAlert className="icon-md" />
        </IconWell>
      </div>
    </AppCard>
  ),
};
