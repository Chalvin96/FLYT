import { Button, Text } from '@flyt/ui';
import type { Meta, StoryObj } from '@storybook/react';

import { AppNavbarPreview } from '@/components/router/AppNavbar/AppNavbarPreview';

import { BaseHeroCard } from './BaseHeroCard';
import { DecoReview } from './decorations';

const meta = {
  title: 'Features/Common/BaseHeroCard',
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
    tone: 'brand',
    label: 'Ready now',
    badge: 'Focus mode',
    title: 'Your review queue',
    subtitle: '12 cards · ~3 min session',
    decoration: <DecoReview />,
    primaryAction: (
      <Button asChild size="sm">
        <a href="/review">
          <Text as="span" size="medium">
            Start review
          </Text>
        </a>
      </Button>
    ),
  },
} satisfies Meta<typeof BaseHeroCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithProgress: Story = {
  args: {
    chip: { label: '3 of 8 lessons' },
    progress: { current: 3, total: 8, showBar: true, showPercentage: true },
  },
};

export const Tones: Story = {
  render: () => (
    <div className="grid gap-4">
      {(['brand', 'calm', 'deep', 'quiet'] as const).map((tone) => (
        <BaseHeroCard
          key={tone}
          label="Ready now"
          badge="Focus mode"
          title="Your review queue"
          subtitle="12 cards · ~3 min session"
          tone={tone}
          primaryAction={
            <Button size="sm" variant="primary">
              Start review
            </Button>
          }
        />
      ))}
    </div>
  ),
};
