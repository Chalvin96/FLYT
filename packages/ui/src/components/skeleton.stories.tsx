import type { Meta, StoryObj } from '@storybook/react';

import { Skeleton } from './skeleton';

const meta = {
  title: 'Design system/Feedback/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Text and headings describe a content form; length trims the line. */
export const TextForms: Story = {
  render: () => (
    <div className="grid max-w-md gap-3">
      <Skeleton size="lg" variant="heading" />
      <Skeleton />
      <Skeleton length="long" />
      <Skeleton length="medium" size="sm" />
      <Skeleton length="short" size="sm" />
    </div>
  ),
};

export const Controls: Story = {
  render: () => (
    <div className="grid max-w-md gap-3">
      <Skeleton size="sm" variant="control" />
      <Skeleton shape="pill" variant="control" />
    </div>
  ),
};

/** A block fills the frame its caller established — here, a card grid cell. */
export const Blocks: Story = {
  render: () => (
    <div className="grid max-w-xl grid-cols-2 gap-3">
      <div className="h-40">
        <Skeleton shape="section" variant="block" />
      </div>
      <div className="h-40">
        <Skeleton shape="field" variant="block" />
      </div>
    </div>
  ),
};

/** A loading card composed from the forms, as a page would use them. */
export const DeckCard: Story = {
  render: () => (
    <div className="max-w-md radius-section border border-default bg-raised p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton length="short" />
          <Skeleton length="medium" size="sm" />
        </div>
        <div className="h-8 w-24">
          <Skeleton shape="pill" variant="block" />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="w-16">
          <Skeleton size="sm" />
        </div>
        <div className="w-20">
          <Skeleton size="sm" />
        </div>
      </div>
      <div className="mt-2 h-1.5">
        <Skeleton shape="pill" variant="block" />
      </div>
    </div>
  ),
};
