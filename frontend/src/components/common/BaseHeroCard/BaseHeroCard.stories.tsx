import type { Meta, StoryObj } from '@storybook/react';

import { AppNavbarPreview } from '@/components/router/AppNavbar/AppNavbarPreview';

import { BaseHeroCard } from './BaseHeroCard';
import { DecoReview } from './decorations';

const meta = {
  title: 'Common/BaseHeroCard',
  component: BaseHeroCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <AppNavbarPreview>
        <div className="max-w-md">
          <Story />
        </div>
      </AppNavbarPreview>
    ),
  ],
  args: {
    className: 'bg-primary-70 text-white-100',
    label: 'Ready now',
    labelClass: 'text-white-60',
    badge: 'Focus mode',
    badgeClass: 'bg-white-20 text-white-100',
    title: 'Your review queue',
    subtitle: '12 cards · ~3 min session',
    subtitleClass: 'text-white-70',
    decoration: <DecoReview />,
    primaryAction: (
      <a className="type-caption text-white-100 underline" href="/review">
        Start review
      </a>
    ),
  },
} satisfies Meta<typeof BaseHeroCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithProgress: Story = {
  args: {
    chip: { label: '3 of 8 lessons', className: 'bg-black-10 text-white-70' },
    progress: { current: 3, total: 8, showBar: true, showPercentage: true },
  },
};
