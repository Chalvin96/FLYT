import { Button } from '@flyt/ui';
import type { Meta, StoryObj } from '@storybook/react';
import { Link, RouterProvider } from '@tanstack/react-router';

import { createStoryRouter } from '@/test/router';

import { FlashCardLessonEnd } from './FlashCardLessonEnd';

const meta = {
  title: 'Features/Flashcard/FlashCardLessonEnd',
  component: FlashCardLessonEnd,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
Shown after the learner completes a lesson. The caller supplies the primary
action label, optional secondary action, and any save or queue error. The
actions appear when \`onPrimaryAction\` is provided.
        `.trim(),
      },
    },
  },
  argTypes: {
    onPrimaryAction: {
      description:
        'Called when the user clicks the primary action. Omit to hide the actions.',
      table: { type: { summary: '() => void | undefined' } },
    },
    className: {
      description: 'Additional Tailwind classes applied to the outer wrapper.',
      table: { type: { summary: 'string | undefined' } },
    },
  },
} satisfies Meta<typeof FlashCardLessonEnd>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const router = createStoryRouter(
      <FlashCardLessonEnd {...args} />,
      ['/'],
      ['/', '/lesson'],
    );
    return <RouterProvider router={router} />;
  },
  args: {
    onPrimaryAction: () => console.log('primary action'),
    secondaryAction: (
      <Button asChild variant="link">
        <Link to="/lesson">Back to lessons</Link>
      </Button>
    ),
  },
};
export const ReviewReady: Story = {
  ...Default,
  args: {
    ...Default.args,
    primaryActionLabel: 'Review 3 cards',
    completedCount: 5,
    hasReviewCards: true,
  },
};

export const LoadingReview: Story = {
  ...Default,
  args: {
    ...Default.args,
    primaryActionLabel: 'Loading review…',
    isSubmitting: true,
  },
};

export const QueueError: Story = {
  ...Default,
  args: {
    ...Default.args,
    primaryActionLabel: 'Try again',
    errorMessage: 'Could not load your review queue.',
  },
};

export const WithoutButton: Story = {
  name: 'No actions',
  parameters: {
    docs: {
      description: {
        story:
          'When `onPrimaryAction` is omitted the actions are not rendered.',
      },
    },
  },
  args: {},
};
