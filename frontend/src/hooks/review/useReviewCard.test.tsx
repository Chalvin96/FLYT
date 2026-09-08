import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { dashboardKeys } from '@/hooks/dashboard/queries';
import { reviewKeys, useReviewCard } from '@/hooks/review/queries';

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn().mockResolvedValue(undefined),
  useMutation: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: mocks.useMutation,
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
  }),
}));

vi.mock('@/api/review', () => ({
  reviewCard: vi.fn(),
}));

describe('useReviewCard', () => {
  it('invalidates deck progress and dashboard stats after review (not due cards)', async () => {
    mocks.useMutation.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    });

    renderHook(() => useReviewCard());

    const mutationOptions = mocks.useMutation.mock.calls[0][0];

    await mutationOptions.onSuccess();

    expect(mocks.invalidateQueries).toHaveBeenCalledTimes(2);
    expect(mocks.invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: reviewKeys.decks.all,
    });
    expect(mocks.invalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: dashboardKeys.stats,
    });
  });

  it('test_review_card_given_submission_expect_api_call', async () => {
    const { reviewCard } = await import('@/api/review');

    mocks.useMutation.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    });

    renderHook(() => useReviewCard());

    const mutationOptions = mocks.useMutation.mock.calls[0][0];

    await mutationOptions.mutationFn({
      userCardId: 42,
      submission: { outcome: 'graded', rating: 3 },
      cardId: 100,
    });

    expect(reviewCard).toHaveBeenCalledWith(
      42,
      { outcome: 'graded', rating: 3 },
      100,
    );
  });
});
