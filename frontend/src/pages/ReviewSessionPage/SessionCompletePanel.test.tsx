import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { MockLink } from '@/test/mockLink';

import { SessionCompletePanel } from './SessionCompletePanel';

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  Link: MockLink,
}));

const actions = {
  onContinueReviewing: vi.fn(),
  onReturnHome: vi.fn(),
  onAddMoreNew: vi.fn(),
};

describe('review completion next step', () => {
  it('test_review_completion_given_cards_due_now_expect_continue_and_home_without_keep_practicing', async () => {
    render(
      <SessionCompletePanel
        {...actions}
        accuracy={83}
        reviewedCount={12}
        nextStep={{
          kind: 'ready',
          dueNowCount: 18,
          hasCardsDueLaterToday: true,
        }}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Session complete' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('12 cards reviewed · 83% accuracy'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('18 cards due now · more later today'),
    ).toBeInTheDocument();
    const continueButton = screen.getByRole('button', {
      name: 'Continue reviewing',
    });
    expect(screen.queryByText('Keep practicing')).not.toBeInTheDocument();
    expect(screen.queryByText('Switch it up')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add more new words' }),
    ).not.toBeInTheDocument();
    await userEvent.click(continueButton);
    expect(actions.onContinueReviewing).toHaveBeenCalledOnce();
    const homeButton = screen.getByRole('button', { name: 'Back to Home' });
    await userEvent.click(homeButton);
    expect(actions.onReturnHome).toHaveBeenCalledOnce();
  });

  it('test_review_completion_given_cards_due_now_without_later_cards_expect_only_due_now_hint', () => {
    render(
      <SessionCompletePanel
        {...actions}
        accuracy={null}
        reviewedCount={1}
        nextStep={{
          kind: 'ready',
          dueNowCount: 1,
          hasCardsDueLaterToday: false,
        }}
      />,
    );

    expect(
      screen.getByText('1 card reviewed · No graded answers'),
    ).toBeInTheDocument();
    expect(screen.getByText('1 card due now')).toBeInTheDocument();
    expect(screen.queryByText(/later today/)).not.toBeInTheDocument();
  });

  it('test_review_completion_given_empty_queue_with_later_cards_expect_caught_up_options_and_later_today_hint', async () => {
    render(
      <SessionCompletePanel
        {...actions}
        accuracy={83}
        reviewedCount={12}
        nextStep={{
          kind: 'ready',
          dueNowCount: 0,
          hasCardsDueLaterToday: true,
        }}
      />,
    );

    expect(
      screen.getByRole('heading', { name: "You're all caught up" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('12 cards reviewed · 83% accuracy'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Nothing due now · more cards later today'),
    ).toBeInTheDocument();
    expect(screen.getByText('Keep practicing')).toBeInTheDocument();
    expect(screen.getByText('Switch it up')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Lesson' })).toHaveAttribute(
      'href',
      '/lesson',
    );
    expect(screen.getByRole('link', { name: 'Reading' })).toHaveAttribute(
      'href',
      '/reading',
    );
    expect(screen.getByRole('link', { name: 'Cards' })).toHaveAttribute(
      'href',
      '/review/cards',
    );
    expect(
      screen.queryByRole('link', { name: 'Story' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Continue reviewing' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/done for today/i)).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Add more new words' }),
    );
    expect(actions.onAddMoreNew).toHaveBeenCalledOnce();
  });

  it('test_review_completion_given_empty_queue_without_later_cards_expect_no_due_hint', () => {
    render(
      <SessionCompletePanel
        {...actions}
        accuracy={null}
        reviewedCount={2}
        nextStep={{
          kind: 'ready',
          dueNowCount: 0,
          hasCardsDueLaterToday: false,
        }}
        isAddMoreNewPending
      />,
    );

    expect(
      screen.getByText('2 cards reviewed · No graded answers'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/due now|later today/)).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add more new words' }),
    ).toBeDisabled();
  });

  it('test_review_completion_given_queue_refresh_pending_expect_summary_without_caught_up_claim', () => {
    render(
      <SessionCompletePanel
        {...actions}
        accuracy={83}
        reviewedCount={12}
        nextStep={{ kind: 'loading' }}
      />,
    );

    expect(
      screen.getByText('12 cards reviewed · 83% accuracy'),
    ).toBeInTheDocument();
    expect(screen.getByText('Checking your review queue…')).toBeInTheDocument();
    expect(screen.queryByText("You're all caught up")).not.toBeInTheDocument();
    expect(screen.queryByText('Keep practicing')).not.toBeInTheDocument();
  });

  it('test_review_completion_given_queue_refresh_failure_expect_retry_without_caught_up_claim', async () => {
    const onRetry = vi.fn();
    render(
      <SessionCompletePanel
        {...actions}
        accuracy={83}
        reviewedCount={12}
        nextStep={{ kind: 'error', onRetry }}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not load your review queue',
    );
    expect(screen.queryByText("You're all caught up")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
