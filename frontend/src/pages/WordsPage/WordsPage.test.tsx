import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import type { CardFacet, CardSort, MyCardsResponse } from '@/types/api';

import { WordsPage } from './WordsPage';

// Render TanStack's <Link> as a plain anchor so the grammar row and empty state
// "Browse lessons" link work without a full router context in unit tests.
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
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

// Provide a minimal lookup context stub so openLemma doesn't throw.
vi.mock('@/components/lookup/useLookupContext', () => ({
  useLookupContext: () => ({
    openLemma: vi.fn(),
    openSearch: vi.fn(),
  }),
}));

const mockData: MyCardsResponse = {
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
      not_started: 1,
      learning: 1,
      familiar: 1,
      known: 1,
      mastered: 1,
    },
  },
  page: 1,
  limit: 50,
  has_more: false,
};

const noop = vi.fn();
const initialControls = {
  facet: 'all' as CardFacet,
  onFacetChange: noop,
  sort: 'weakest' as CardSort,
  onSortChange: noop,
  query: '',
  onQueryChange: noop,
  showNotStarted: false,
  onShowNotStartedChange: noop,
};

describe('WordsPage (My Cards gallery)', () => {
  it('test_card_search_given_empty_query_expect_persistent_accessible_name', () => {
    render(
      <WordsPage
        data={mockData}
        isPending={false}
        isError={false}
        {...initialControls}
      />,
    );

    expect(
      screen.getByRole('textbox', { name: 'Search your cards' }),
    ).toHaveValue('');
  });

  it('renders the summary strip with per-bucket counts', () => {
    render(
      <WordsPage
        data={mockData}
        isPending={false}
        isError={false}
        {...initialControls}
      />,
    );

    const strip = screen.getByTestId('summary-strip');
    expect(strip).toBeInTheDocument();
    expect(strip).toHaveTextContent('5 cards total');

    expect(screen.getByTestId('bucket-not_started')).toHaveTextContent('1');
    expect(screen.getByTestId('bucket-not_started')).toHaveTextContent(
      'Not started',
    );
    expect(screen.getByTestId('bucket-learning')).toHaveTextContent('1');
    expect(screen.getByTestId('bucket-learning')).toHaveTextContent('Learning');
    expect(screen.getByTestId('bucket-mastered')).toHaveTextContent('1');
    expect(screen.getByTestId('bucket-mastered')).toHaveTextContent('Mastered');
  });

  it('renders facet tabs All / Vocab / Grammar', () => {
    render(
      <WordsPage
        data={mockData}
        isPending={false}
        isError={false}
        {...initialControls}
      />,
    );

    const tabs = screen.getAllByRole('button', { name: /^Vocab$/i });
    expect(tabs).toHaveLength(1);
    expect(tabs[0]).toHaveAttribute('aria-pressed', 'false');

    expect(screen.getByRole('button', { name: /^All$/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      screen.getByRole('button', { name: /^Grammar$/i }),
    ).toBeInTheDocument();
  });

  it('renders mastery badges for each card row', () => {
    render(
      <WordsPage
        data={mockData}
        isPending={false}
        isError={false}
        {...initialControls}
      />,
    );

    expect(screen.getByTestId('badge-learning')).toHaveTextContent('Learning');
    expect(screen.getByTestId('badge-mastered')).toHaveTextContent('Mastered');
  });

  it('shows vocab card labels and subtitles', () => {
    render(
      <WordsPage
        data={mockData}
        isPending={false}
        isError={false}
        {...initialControls}
      />,
    );

    // Vocab cards render as flat rows; grammar card labels are hidden inside
    // a collapsed group (covered by the grouping test below).
    expect(screen.getByText('hund')).toBeInTheDocument();
    expect(screen.getByText('dog')).toBeInTheDocument();
  });

  it('renders the grammar card as a link to the lesson route when the group is expanded', () => {
    render(
      <WordsPage
        data={mockData}
        isPending={false}
        isError={false}
        {...initialControls}
      />,
    );

    // Grammar cards are collapsed inside a group; expand it first.
    fireEvent.click(screen.getByRole('button', { name: /past tense/i }));

    const link = screen.getByRole('link', { name: /past tense/i });
    expect(link).toHaveAttribute('href', '/lesson/42');
  });

  // --- TASK A: grammar grouping ---

  it('groups grammar cards by lesson into a collapsible row', () => {
    const groupedData: MyCardsResponse = {
      cards: [
        {
          user_card_id: 10,
          facet: 'grammar',
          label: 'Card A',
          subtitle: null,
          bucket: 'learning',
          lemma_uuid: null,
          lesson_id: 99,
          lesson_title: 'Intro to Nouns',
        },
        {
          user_card_id: 11,
          facet: 'grammar',
          label: 'Card B',
          subtitle: null,
          bucket: 'mastered',
          lemma_uuid: null,
          lesson_id: 99,
          lesson_title: 'Intro to Nouns',
        },
      ],
      summary: {
        total: 2,
        counts_by_bucket: {
          not_started: 0,
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

    render(
      <WordsPage
        data={groupedData}
        isPending={false}
        isError={false}
        {...initialControls}
      />,
    );

    // The group header shows the lesson title and card count.
    expect(screen.getByText('Intro to Nouns')).toBeInTheDocument();
    expect(screen.getByText('2 cards')).toBeInTheDocument();

    // Member card labels are hidden while collapsed.
    expect(screen.queryByText('Card A')).not.toBeInTheDocument();
    expect(screen.queryByText('Card B')).not.toBeInTheDocument();

    // Expand the group.
    fireEvent.click(screen.getByRole('button', { name: /intro to nouns/i }));

    // Member card labels are now visible.
    expect(screen.getByText('Card A')).toBeInTheDocument();
    expect(screen.getByText('Card B')).toBeInTheDocument();
  });

  it('shows the friendly empty state when there are no cards', () => {
    const emptyData: MyCardsResponse = {
      cards: [],
      summary: {
        total: 0,
        counts_by_bucket: {
          not_started: 0,
          learning: 0,
          familiar: 0,
          known: 0,
          mastered: 0,
        },
      },
      page: 1,
      limit: 50,
      has_more: false,
    };

    render(
      <WordsPage
        data={emptyData}
        isPending={false}
        isError={false}
        {...initialControls}
      />,
    );

    expect(screen.getByText('No cards yet')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /browse lessons/i }),
    ).toHaveAttribute('href', '/lesson');
  });

  it('shows the not-started count chip when started-only cards are displayed', () => {
    render(
      <WordsPage
        data={mockData}
        isPending={false}
        isError={false}
        {...initialControls}
      />,
    );

    // F2: toggle copy reads as an action, not a status pill.
    expect(screen.getByText(/Show 1 not-started card/i)).toBeInTheDocument();
  });

  it('shows the active filter and sort summary', () => {
    render(
      <WordsPage
        data={mockData}
        isPending={false}
        isError={false}
        {...initialControls}
      />,
    );

    const summary = screen.getByTestId('cards-summary');
    expect(summary).toHaveTextContent('All');
    expect(summary).toHaveTextContent('Weakest first');
  });

  it('keeps the active summary focused on filters when not-started cards are shown', () => {
    render(
      <WordsPage
        data={mockData}
        isPending={false}
        isError={false}
        {...initialControls}
        showNotStarted
      />,
    );

    expect(screen.getByTestId('cards-summary')).toHaveTextContent(
      'All · Weakest first',
    );
  });

  // --- F1: removable search chip ---

  it('renders a removable search chip that clears the query', () => {
    const onQueryChange = vi.fn();
    render(
      <WordsPage
        data={mockData}
        isPending={false}
        isError={false}
        {...initialControls}
        query="hund"
        onQueryChange={onQueryChange}
      />,
    );

    const chip = screen.getByRole('button', {
      name: /Clear search "hund"/i,
    });
    expect(chip).toBeInTheDocument();

    fireEvent.click(chip);
    expect(onQueryChange).toHaveBeenCalledWith('');
  });

  // --- F5: filtered empty state ---

  it('names the active query in the filtered empty state and offers Clear search', () => {
    render(
      <WordsPage
        data={{ ...mockData, cards: [] }}
        isPending={false}
        isError={false}
        {...initialControls}
        query="xyz"
      />,
    );

    expect(screen.getByText(/No cards match "xyz"/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Clear search/i }),
    ).toBeInTheDocument();
  });

  it('names the active facet in the filtered empty state', () => {
    render(
      <WordsPage
        data={{ ...mockData, cards: [] }}
        isPending={false}
        isError={false}
        {...initialControls}
        facet="vocab"
      />,
    );

    expect(
      screen.getByText(/No vocab cards in this view/i),
    ).toBeInTheDocument();
  });

  it('offers both Clear search and Back to started cards in the filtered empty state', () => {
    render(
      <WordsPage
        data={{ ...mockData, cards: [] }}
        isPending={false}
        isError={false}
        {...initialControls}
        query="nomatch"
        showNotStarted
      />,
    );

    expect(
      screen.getByRole('button', { name: /Clear search/i }),
    ).toBeInTheDocument();
    // When showNotStarted is true, "Back to started cards" renders both inside
    // the filtered empty state and as the bottom inverse toggle.
    expect(
      screen.getAllByRole('button', { name: /Back to started cards/i }),
    ).toHaveLength(2);
  });

  // --- F3: mastery rank dots ---

  it('renders mastery rank dots inside row badges without changing the label', () => {
    render(
      <WordsPage
        data={mockData}
        isPending={false}
        isError={false}
        {...initialControls}
      />,
    );

    const learningBadge = screen.getByTestId('badge-learning');
    expect(learningBadge).toHaveTextContent('Learning');
    expect(
      within(learningBadge).getByTestId('mastery-rank-learning'),
    ).toBeInTheDocument();

    const masteredBadge = screen.getByTestId('badge-mastered');
    expect(masteredBadge).toHaveTextContent('Mastered');
    expect(
      within(masteredBadge).getByTestId('mastery-rank-mastered'),
    ).toBeInTheDocument();
  });

  it('renders mastery rank dots in the summary strip bucket chips', () => {
    render(
      <WordsPage
        data={mockData}
        isPending={false}
        isError={false}
        {...initialControls}
      />,
    );

    const notStartedChip = screen.getByTestId('bucket-not_started');
    expect(
      within(notStartedChip).getByTestId('mastery-rank-not_started'),
    ).toBeInTheDocument();
  });
});
