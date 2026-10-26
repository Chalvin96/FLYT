import type { Meta, StoryObj } from '@storybook/react';

import { LessonLayout } from '@/pages/LessonDetailPage/components/LessonLayout';
import { DeckBrowseSection } from '@/pages/ReviewPage/DeckBrowseSection';

import { BaseHeroCard } from './BaseHeroCard/BaseHeroCard';

const meta = {
  title: 'Features/Common/Progress',
  parameters: { layout: 'padded' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const TenPercent: Story = {
  render: () => (
    <div className="max-w-md space-y-4">
      <BaseHeroCard
        label="Lesson progress"
        title="Keep learning"
        primaryAction={null}
        progress={{
          current: 1,
          total: 10,
          showBar: true,
          showPercentage: true,
        }}
      />
      <LessonLayout
        title="Personal pronouns"
        progressCurrent={0}
        totalPages={10}
        progressPercent={10}
      >
        Lesson content
      </LessonLayout>
      <DeckBrowseSection
        decks={[
          {
            id: 1,
            name: 'Everyday words',
            description: null,
            card_count: 10,
            studied_count: 1,
            is_subscribed: true,
          },
        ]}
      />
    </div>
  ),
};
