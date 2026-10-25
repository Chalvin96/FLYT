import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, within } from 'storybook/test';
import { useMemo, type ReactNode } from 'react';
import { RouterProvider } from '@tanstack/react-router';

import { createStoryRouter } from '@/test/router';

import { SessionCompletePanel } from './SessionCompletePanel';

const meta = {
  title: 'Features/Review/Session complete',
  component: SessionCompletePanel,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <RouterDecorator>
        <Story />
      </RouterDecorator>
    ),
  ],
  args: {
    accuracy: 83,
    reviewedCount: 12,
    onContinueReviewing: fn(),
    onReturnHome: fn(),
    onAddMoreNew: fn(),
  },
} satisfies Meta<typeof SessionCompletePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CardsRemain: Story = {
  args: {
    nextStep: { kind: 'ready', dueNowCount: 18, hasCardsDueLaterToday: true },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { name: 'Session complete' }),
    ).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'Continue reviewing' }),
    ).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'Back to Home' }),
    ).toBeVisible();
    await expect(canvas.queryByText('Keep practicing')).not.toBeInTheDocument();
  },
};

export const CaughtUp: Story = {
  args: {
    nextStep: { kind: 'ready', dueNowCount: 0, hasCardsDueLaterToday: true },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { name: "You're all caught up" }),
    ).toBeVisible();
    await expect(
      canvas.getByText('Nothing due now · more cards later today'),
    ).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'Add more new words' }),
    ).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Reading' })).toBeVisible();
    await expect(
      canvas.queryByRole('button', { name: 'Continue reviewing' }),
    ).not.toBeInTheDocument();
  },
};

export const CardsRemainWithoutLaterCards: Story = {
  args: {
    nextStep: { kind: 'ready', dueNowCount: 18, hasCardsDueLaterToday: false },
  },
};

export const CaughtUpWithoutLaterCards: Story = {
  args: {
    nextStep: { kind: 'ready', dueNowCount: 0, hasCardsDueLaterToday: false },
    accuracy: null,
  },
};

function RouterDecorator({ children }: { children: ReactNode }) {
  const router = useMemo(
    () =>
      createStoryRouter(
        children,
        ['/review/session'],
        ['/review/session', '/lesson', '/reading', '/review/cards'],
      ),
    [children],
  );
  return <RouterProvider router={router} />;
}
