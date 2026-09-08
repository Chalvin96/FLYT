import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ReviewCardsRouteComponent } from '@/pages/WordsPage/ReviewCardsRouteComponent';
import type { MyCardsResponse } from '@/types/api';

// Render TanStack's <Link> as a plain anchor and no-op createFileRoute so the
// route module loads and WordsPage's links work without a router context.
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  createFileRoute: () => () => ({}),
  Link: ({
    children,
    to,
    params,
  }: {
    children: ReactNode;
    to: string;
    params?: Record<string, string>;
  }) => (
    <a href={to.replace('$lessonId', params?.lessonId ?? '')}>{children}</a>
  ),
}));

// Provide a minimal lookup context stub so openLemma/openSearch don't throw.
vi.mock('@/components/lookup/useLookupContext', () => ({
  useLookupContext: () => ({
    openLemma: vi.fn(),
    openSearch: vi.fn(),
  }),
}));

const { getMyCards } = vi.hoisted(() => ({
  getMyCards: vi.fn(),
}));

vi.mock('@/api/cards', () => ({
  getMyCards,
}));

const mockResponse: MyCardsResponse = {
  cards: [
    {
      user_card_id: 1,
      facet: 'vocab',
      label: 'hund',
      subtitle: 'dog',
      bucket: 'learning',
      lemma_uuid: 'uuid-1',
      lesson_id: null,
      lesson_title: null,
    },
    {
      user_card_id: 2,
      facet: 'grammar',
      label: 'Past tense',
      subtitle: null,
      bucket: 'mastered',
      lemma_uuid: null,
      lesson_id: 42,
      lesson_title: 'Past Tense',
    },
  ],
  summary: {
    total: 5,
    counts_by_bucket: {
      not_started: 3,
      learning: 1,
      familiar: 0,
      known: 0,
      mastered: 1,
    },
  },
  page: 1,
  limit: 50,
  has_more: false,
};

function renderRoute() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ReviewCardsRouteComponent />
    </QueryClientProvider>,
  );
}

// Regression test for the F0 bug where the route passed the toggle as
// camelCase `startedOnly` while the API reads snake_case `started_only`.
// Asserting against the actual argument object (not just the query key) is
// what catches a revert to the wrong casing.
describe('ReviewCardsRouteComponent (My Cards route)', () => {
  beforeEach(() => {
    getMyCards.mockReset();
    getMyCards.mockResolvedValue(mockResponse);
  });

  it('maps the not-started toggle to snake_case started_only + bucket params', async () => {
    renderRoute();

    // Initial render: started-only view, no bucket filter.
    await waitFor(() => {
      expect(getMyCards).toHaveBeenCalledWith(
        expect.objectContaining({ started_only: true, bucket: null }),
      );
    });

    // Activate the not-started view via the toggle rendered by WordsPage.
    const toggle = await screen.findByRole('button', {
      name: /Show 3 not-started cards/i,
    });
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(getMyCards).toHaveBeenCalledWith(
        expect.objectContaining({
          started_only: false,
          bucket: 'not_started',
        }),
      );
    });
  });

  it('test_card_list_given_second_page_slice_expect_merges_cards', async () => {
    const secondPage: MyCardsResponse = {
      ...mockResponse,
      page: 2,
      has_more: false,
      cards: [
        {
          user_card_id: 3,
          facet: 'grammar',
          label: 'Future tense',
          subtitle: null,
          bucket: 'familiar',
          lemma_uuid: null,
          lesson_id: 42,
          lesson_title: 'Past Tense',
        },
        {
          user_card_id: 4,
          facet: 'vocab',
          label: 'bok',
          subtitle: 'book',
          bucket: 'familiar',
          lemma_uuid: 'uuid-3',
          lesson_id: null,
          lesson_title: null,
        },
      ],
    };
    getMyCards.mockImplementation(({ page }: { page: number }) =>
      Promise.resolve(
        page === 2 ? secondPage : { ...mockResponse, has_more: true },
      ),
    );

    renderRoute();

    const loadMore = await screen.findByRole('button', {
      name: 'Load more cards',
    });
    fireEvent.click(loadMore);

    await waitFor(() => {
      expect(getMyCards).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, limit: 50 }),
      );
    });
    expect(await screen.findByText('bok')).toBeInTheDocument();
    expect(screen.getAllByText('hund')).toHaveLength(1);
    expect(screen.getByText('2 cards')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /past tense/i }));

    expect(screen.getByText('Past tense')).toBeInTheDocument();
    expect(screen.getByText('Future tense')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Load more cards' }),
    ).not.toBeInTheDocument();
  });

  it('test_card_list_given_next_page_failure_expect_keeps_cards_and_offers_retry', async () => {
    let nextPageAttempts = 0;
    getMyCards.mockImplementation(({ page }: { page: number }) => {
      if (page === 1) {
        return Promise.resolve({ ...mockResponse, has_more: true });
      }

      nextPageAttempts += 1;
      return Promise.reject(new Error('Request failed'));
    });

    renderRoute();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Load more cards' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load more cards',
    );
    expect(screen.getByText('hund')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(nextPageAttempts).toBe(2));
    expect(screen.getByText('hund')).toBeInTheDocument();
  });
});
