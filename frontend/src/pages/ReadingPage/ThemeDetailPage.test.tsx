import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { readingKeys } from '@/hooks/reading/queries';

import { ThemeDetailPage } from './ThemeDetailPage';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params,
    to,
  }: {
    children: ReactNode;
    params?: Record<string, string>;
    to: string;
  }) => {
    let href = to;
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        href = href.replace(`$${key}`, value);
      }
    }
    return <a href={href}>{children}</a>;
  },
}));

const { getReadingStories } = vi.hoisted(() => ({
  getReadingStories: vi.fn(),
}));

vi.mock('@/api/reading', () => ({
  getReadingStories,
}));

const baseStories = [
  {
    uuid: 'story-1',
    title: 'Morning Coffee',
    cefrLevel: 'A1',
    createdAt: '2026-04-11T10:00:00Z',
    wordCount: 245,
    groupKey: 'daily_life',
    groupTitle: 'Daily Life',
    isRead: false,
    readAt: null,
  },
  {
    uuid: 'story-2',
    title: 'On the Tram',
    cefrLevel: 'A2',
    createdAt: '2026-04-10T10:00:00Z',
    wordCount: 198,
    groupKey: 'daily_life',
    groupTitle: 'Daily Life',
    isRead: true,
    readAt: '2026-04-10T12:00:00Z',
  },
  {
    uuid: 'story-3',
    title: 'After Work',
    cefrLevel: 'B1',
    createdAt: '2026-04-09T10:00:00Z',
    wordCount: 312,
    groupKey: 'daily_life',
    groupTitle: 'Daily Life',
    isRead: false,
    readAt: null,
  },
] as const;

function ThemeFiltersHarness({ initialLevels }: { initialLevels: string[] }) {
  const [selectedLevels, setSelectedLevels] = useState(initialLevels);
  return (
    <ThemeDetailPage
      themeKey="daily_life"
      selectedLevels={selectedLevels}
      onSelectedLevelsChange={setSelectedLevels}
    />
  );
}

function renderPage(initialLevels: string[] = []) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <ThemeFiltersHarness initialLevels={initialLevels} />
    </QueryClientProvider>,
  );
  return { ...view, queryClient };
}

function mockCursorPages(totalCount = 21) {
  const allStories = Array.from({ length: totalCount }, (_, index) => ({
    ...baseStories[0],
    uuid: `story-${index + 1}`,
    title: index === 20 ? 'Rainy Saturday' : `Morning Coffee ${index + 1}`,
    cefrLevel: index < 21 ? 'A1' : 'A2',
    isRead: index >= 21,
  }));
  getReadingStories.mockImplementation(
    async (
      _groupKey: string,
      options?: {
        cursor?: string | null;
        levels?: string[];
        showReadStories?: boolean;
      },
    ) => {
      const filteredStories = allStories.filter(
        (story) =>
          (options?.showReadStories || !story.isRead) &&
          (!options?.levels?.length ||
            options.levels.includes(story.cefrLevel)),
      );
      const offset = Number(options?.cursor ?? 0);
      return {
        group: {
          id: 1,
          key: 'daily_life',
          order: 1,
          storyCount: totalCount,
          title: 'Daily Life',
        },
        stories: filteredStories.slice(offset, offset + 20),
        nextCursor:
          offset + 20 < filteredStories.length ? String(offset + 20) : null,
        totalCount,
        levelCounts: {
          A1: Math.min(21, totalCount),
          A2: Math.max(0, totalCount - 21),
        },
      };
    },
  );
}

describe('ThemeDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getReadingStories.mockImplementation(
      async (
        _groupKey: string,
        options?: { levels?: string[]; showReadStories?: boolean },
      ) => {
        const filteredStories = baseStories.filter((story) => {
          if (!options?.showReadStories && story.isRead) {
            return false;
          }
          if (options?.levels && options.levels.length > 0) {
            return options.levels.includes(story.cefrLevel);
          }
          return true;
        });

        return {
          group: {
            id: 1,
            key: 'daily_life',
            order: 1,
            storyCount: 3,
            title: 'Daily Life',
          },
          stories: filteredStories,
          nextCursor: null,
          totalCount: 3,
          levelCounts: { A1: 1, A2: 1, B1: 1 },
        };
      },
    );
  });

  it('test_theme_grid_given_stories_expect_links_metadata_and_filters', async () => {
    const user = userEvent.setup();

    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Daily Life' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Showing 3 of 3 stories')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Morning Coffee' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/245 words/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Morning Coffee/ }),
    ).toHaveAttribute('href', '/reading/story/story-1');
    expect(screen.getByRole('link', { name: /On the Tram/ })).toHaveAttribute(
      'href',
      '/reading/story/story-2',
    );
    expect(screen.getByText('In progress')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Filters \(/ }));
    const firstDialog = screen.getByRole('dialog');
    await user.click(within(firstDialog).getByLabelText('Hide read stories'));
    await user.click(
      within(firstDialog).getByRole('button', { name: 'Apply' }),
    );

    expect(screen.getByText('Showing 2 matching stories')).toBeInTheDocument();
    expect(screen.queryByText('On the Tram')).not.toBeInTheDocument();

    const secondDialog = screen.queryByRole('dialog');

    if (!secondDialog) {
      await user.click(screen.getByRole('button', { name: /Filters \(/ }));
    }

    const activeDialog = screen.getByRole('dialog');
    await user.click(within(activeDialog).getByLabelText(/Beginner 1 \(A1\)/));
    await user.click(
      within(activeDialog).getByRole('button', { name: 'Apply' }),
    );

    expect(screen.getByText('Showing 1 matching story')).toBeInTheDocument();
    expect(screen.getByText('Morning Coffee')).toBeInTheDocument();
    expect(screen.queryByText('After Work')).not.toBeInTheDocument();
  });

  it('test_theme_filters_given_selected_a2_level_expect_filtered_query_and_checked_option', async () => {
    renderPage(['A2']);
    expect(await screen.findByText('On the Tram')).toBeInTheDocument();
    expect(screen.queryByText('Morning Coffee')).not.toBeInTheDocument();
    expect(screen.queryByText('After Work')).not.toBeInTheDocument();
    expect(getReadingStories).toHaveBeenCalledWith(
      'daily_life',
      expect.objectContaining({ levels: ['A2'] }),
    );
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Filters (1)' }));
    expect(
      within(screen.getByRole('dialog')).getByLabelText(/Beginner 2 \(A2\)/),
    ).toBeChecked();
  });

  it.each([
    ['C1', 'Advanced 1 (C1)'],
    ['C2', 'Advanced 2 (C2)'],
  ])(
    'test_theme_filters_given_advanced_url_level_expect_checked_filter_and_clearable_selection',
    async (level, label) => {
      const user = userEvent.setup();
      getReadingStories.mockResolvedValue({
        group: {
          id: 1,
          key: 'daily_life',
          order: 1,
          storyCount: 1,
          title: 'Daily Life',
        },
        stories: [{ ...baseStories[0], cefrLevel: level }],
        nextCursor: null,
        totalCount: 1,
        levelCounts: { [level]: 1 },
      });
      renderPage([level]);
      await user.click(
        await screen.findByRole('button', { name: 'Filters (1)' }),
      );
      const dialog = screen.getByRole('dialog');
      expect(
        within(dialog).getByRole('checkbox', {
          name: `${label} 1`,
        }),
      ).toBeChecked();
      expect(getReadingStories).toHaveBeenCalledWith(
        'daily_life',
        expect.objectContaining({ levels: [level] }),
      );
      await user.click(within(dialog).getByRole('button', { name: 'Close' }));
      await user.click(
        screen.getByRole('button', { name: 'Remove all level filters' }),
      );
      await waitFor(() => {
        expect(getReadingStories).toHaveBeenLastCalledWith(
          'daily_life',
          expect.objectContaining({ levels: [] }),
        );
      });
      expect(screen.getByText('Morning Coffee')).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /Filters/ }),
      ).not.toBeInTheDocument();
    },
  );

  it('test_mobile_filters_given_apply_expect_sheet_closed', async () => {
    const user = userEvent.setup();

    renderPage();

    expect(
      await screen.findByRole('button', { name: /Filters \(/ }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Filters \(/ }));

    expect(
      await screen.findByRole('button', { name: 'Apply' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Apply' }),
      ).not.toBeInTheDocument();
    });
  });

  it('test_mobile_filters_given_dismiss_expect_draft_discarded', async () => {
    const user = userEvent.setup();

    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Daily Life' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Showing 3 of 3 stories')).toBeInTheDocument();
    expect(screen.getByText('On the Tram')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Filters \(/ }));

    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByLabelText('Hide read stories'));
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Showing 3 of 3 stories')).toBeInTheDocument();
    expect(screen.getByText('On the Tram')).toBeInTheDocument();
  });

  it('test_theme_pagination_given_more_clicked_expect_next_cursor_loaded', async () => {
    mockCursorPages();
    renderPage();

    expect(
      (await screen.findAllByText('Showing 20 of 21 stories'))[0],
    ).toBeInTheDocument();
    expect(getReadingStories).toHaveBeenCalledTimes(1);
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Show 1 more' }));

    expect(await screen.findByText('Rainy Saturday')).toBeInTheDocument();
    expect(screen.getByText('Showing 21 of 21 stories')).toBeInTheDocument();
    expect(screen.getAllByText('Morning Coffee 1')).toHaveLength(1);
    expect(getReadingStories).toHaveBeenLastCalledWith(
      'daily_life',
      expect.objectContaining({ cursor: '20', limit: 20 }),
    );
  });

  it('test_theme_pagination_given_level_filter_expect_remaining_count_from_level_totals', async () => {
    mockCursorPages(100);
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole('button', { name: 'Filters (0)' }),
    );
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByLabelText(/Beginner 1 \(A1\)/));
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }));

    const more = await screen.findByRole('button', { name: 'Show 1 more' });
    expect(screen.getAllByText('Showing 20 of 21 stories')).toHaveLength(2);
    await user.click(more);
    expect(await screen.findByText('Rainy Saturday')).toBeInTheDocument();
    expect(
      screen.getByText("That's all 21 matching stories."),
    ).toBeInTheDocument();
  });

  it('test_theme_pagination_given_hide_read_filter_expect_unknown_remainder_label', async () => {
    mockCursorPages(100);
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole('button', { name: 'Filters (0)' }),
    );
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByLabelText('Hide read stories'));
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }));

    const more = await screen.findByRole('button', {
      name: 'Show up to 20 more',
    });
    expect(screen.getAllByText('Showing 20 matching stories')).toHaveLength(2);
    await user.click(more);
    expect(await screen.findByText('Rainy Saturday')).toBeInTheDocument();
    expect(screen.getByText('Showing 21 matching stories')).toBeInTheDocument();
    expect(
      screen.getByText("That's all 21 matching stories."),
    ).toBeInTheDocument();
  });
  it('test_theme_given_next_page_failure_expect_loaded_stories_and_retry', async () => {
    mockCursorPages();
    const user = userEvent.setup();
    renderPage();
    const more = await screen.findByRole('button', { name: 'Show 1 more' });
    getReadingStories.mockRejectedValueOnce(new Error('Page unavailable'));

    await user.click(more);

    expect(
      await screen.findByText('Could not load more stories.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Morning Coffee 1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Rainy Saturday')).toBeInTheDocument();
    expect(
      screen.queryByText('Could not load more stories.'),
    ).not.toBeInTheDocument();
  });

  it('test_theme_given_cached_page_refresh_failure_expect_no_next_page_error', async () => {
    mockCursorPages();
    const { queryClient } = renderPage();
    await screen.findByRole('button', { name: 'Show 1 more' });
    getReadingStories.mockRejectedValueOnce(new Error('Refresh unavailable'));

    await act(async () => {
      await queryClient.refetchQueries({
        queryKey: readingKeys.storiesInfinitePrefix,
      });
    });

    expect(screen.getByText('Morning Coffee 1')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Show 1 more' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Could not load more stories.'),
    ).not.toBeInTheDocument();
  });

  it('test_theme_given_one_story_expect_no_filters_or_more_button', async () => {
    getReadingStories.mockResolvedValue({
      group: {
        id: 1,
        key: 'daily_life',
        order: 1,
        storyCount: 1,
        title: 'Daily Life',
      },
      stories: [baseStories[0]],
      nextCursor: null,
      totalCount: 1,
      levelCounts: { A1: 1 },
    });
    renderPage();
    expect(await screen.findByText('Showing 1 of 1 story')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Filters/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Show .* more/ }),
    ).not.toBeInTheDocument();
  });

  it('test_theme_given_empty_theme_expect_quiet_empty_state_without_filters', async () => {
    getReadingStories.mockResolvedValue({
      group: {
        id: 1,
        key: 'daily_life',
        order: 1,
        storyCount: 0,
        title: 'Daily Life',
      },
      stories: [],
      nextCursor: null,
      totalCount: 0,
      levelCounts: {},
    });
    renderPage();
    expect(
      await screen.findByRole('heading', {
        name: 'No stories in this theme yet',
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Clear filters|Filters/ }),
    ).not.toBeInTheDocument();
  });

  it('test_theme_given_filters_without_matches_expect_one_clear_filters_action', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(
      await screen.findByRole('button', { name: 'Filters (0)' }),
    );
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByLabelText(/Beginner 2/));
    await user.click(within(dialog).getByLabelText('Hide read stories'));
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }));
    expect(
      await screen.findByRole('heading', { name: 'No matches' }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: 'Clear filters' }),
    ).toHaveLength(1);
    expect(
      screen.queryByRole('button', { name: 'Clear all' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByText('Morning Coffee')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Filters (0)' }),
    ).toBeInTheDocument();
  });
});
