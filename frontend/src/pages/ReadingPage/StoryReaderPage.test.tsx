import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import {
  ChatbotProvider,
  useChatbot,
} from '@/components/chatbot/ChatbotProvider';
import { LookupProvider } from '@/components/lookup/LookupProvider';
import { LookupSheet } from '@/components/lookup/LookupSheet';

import { StoryReaderPage } from './StoryReaderPage';

interface RouterState {
  location: { pathname: string };
}

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params,
    to,
  }: {
    children: ReactNode;
    params?: Record<string, string>;
    to: string;
  }): ReactNode => {
    let href = to;
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        href = href.replace(`$${key}`, value);
      }
    }
    return <a href={href}>{children}</a>;
  },
  useRouterState: ({ select }: { select: (s: RouterState) => string }) =>
    select({ location: { pathname: '/reading/story/story-1' } }),
  useMatch: () => ({ id: '/_reader/reading/story/$uuid' }),
}));

const {
  addLemmaToDeck,
  browseHeadword,
  getLemmaDefinitions,
  getReadingStory,
  getReadingStoryRecommendations,
  markLemmaKnown,
  saveReadingProgress,
} = vi.hoisted(() => ({
  addLemmaToDeck: vi.fn(),
  browseHeadword: vi.fn(),
  getLemmaDefinitions: vi.fn(),
  getReadingStory: vi.fn(),
  getReadingStoryRecommendations: vi.fn(),
  markLemmaKnown: vi.fn(),
  saveReadingProgress: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/api/reading', () => ({
  getReadingStory,
  getReadingStoryRecommendations,
  saveReadingProgress,
}));

vi.mock('@/api/lexicon', () => ({
  browseHeadword,
  getLemmaDefinitions,
  markLemmaKnown,
}));

vi.mock('@/api/review', () => ({
  addLemmaToDeck,
}));

function ReaderUrlHarness({
  initialPage,
  onNavigate,
}: {
  initialPage?: number;
  onNavigate: (page: number) => void;
}) {
  const [page, setPage] = useState(initialPage);

  return (
    <StoryReaderPage
      page={page}
      onPageChange={(next) => {
        onNavigate(next);
        setPage(next);
      }}
      storyUuid="story-1"
    />
  );
}

function ChatbotContextProbe() {
  const { context } = useChatbot();
  return (
    <div
      data-testid="chatbot-page-context"
      data-context={
        context ? `${context.kind}|${context.label}|${context.detail}` : 'none'
      }
    />
  );
}

function renderPage(initialPage?: number) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const onNavigate = vi.fn();

  return {
    onNavigate,
    ...render(
      <QueryClientProvider client={queryClient}>
        <ChatbotProvider>
          <LookupProvider>
            <ReaderUrlHarness
              initialPage={initialPage}
              onNavigate={onNavigate}
            />
            <ChatbotContextProbe />
            <LookupSheet />
          </LookupProvider>
        </ChatbotProvider>
      </QueryClientProvider>,
    ),
  };
}

function buildStoryTokens(content: string) {
  const lemmaUuidByWord: Record<string, string> = {
    lager: 'lemma-lager',
    kaffe: 'lemma-kaffe',
    tidlig: 'lemma-tidlig',
    sitter: 'lemma-sitte',
    vinduet: 'lemma-vindu',
    leser: 'lemma-lese',
    avisen: 'lemma-avis',
    igjen: 'lemma-igjen',
    regnet: 'lemma-regn',
    te: 'lemma-te',
  };

  return Array.from(content.matchAll(/\p{L}+/gu), (match) => {
    const word = match[0];
    const start = match.index ?? 0;

    return {
      word,
      start,
      end: start + word.length,
      lemmaUuid: lemmaUuidByWord[word.toLowerCase()] ?? null,
    };
  });
}

function buildStoryResponse({
  pageIndex,
  totalPages = 1,
  lastPageIndex = 0,
  completed = false,
  content = 'Ida lager kaffe tidlig.\n\nHun sitter ved vinduet og leser avisen før jobb.',
}: {
  pageIndex: number;
  totalPages?: number;
  lastPageIndex?: number;
  completed?: boolean;
  content?: string;
}) {
  return {
    uuid: 'story-1',
    title: 'Morning Coffee',
    cefrLevel: 'A1',
    groupKey: 'daily_life',
    groupTitle: 'Daily Life',
    page: {
      index: pageIndex,
      content,
      tokens: buildStoryTokens(content),
    },
    totalPages,
    lastPageIndex,
    completed,
    userStates: {
      'lemma-lager': 'new',
      'lemma-kaffe': 'new',
      'lemma-tidlig': 'mastered',
      'lemma-sitte': 'new',
      'lemma-vindu': 'learning',
      'lemma-lese': 'new',
      'lemma-avis': 'mastered',
    },
  };
}

function notReadyImportError() {
  return Object.assign(new Error('Request failed'), {
    isAxiosError: true,
    response: {
      status: 409,
      data: {
        detail: {
          code: 'IMPORT_NOT_READY',
          message: 'Import is processing.',
        },
      },
    },
    config: {},
  });
}

describe('StoryReaderPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getReadingStory.mockResolvedValue(buildStoryResponse({ pageIndex: 0 }));
    getReadingStoryRecommendations.mockResolvedValue({
      stories: [
        {
          uuid: 'story-2',
          title: 'On the Tram',
          cefrLevel: 'A2',
          createdAt: '2026-04-10T07:00:00Z',
          preview: 'A short commute turns into a tiny language lesson.',
          wordCount: 198,
          isRead: false,
        },
        {
          uuid: 'story-3',
          title: 'Lunch Menu',
          cefrLevel: 'A1',
          createdAt: '2026-04-09T07:00:00Z',
          preview: 'A simple lunch order with soup, bread, and tea.',
          wordCount: 184,
          isRead: false,
        },
      ],
    });
    getLemmaDefinitions.mockResolvedValue({
      lemma: {
        uuid: 'lemma-kaffe',
        word: 'kaffe',
        pos: 'noun',
        primary_translation: 'coffee',
      },
      definitions: [
        {
          uuid: 'definition-kaffe-1',
          definition: 'coffee as a drink',
          translation: 'coffee',
          translation_source: 'test',
          examples: [{ no: 'Jeg drikker kaffe hver morgen.', en: null }],
          userState: 'new',
        },
      ],
    });
    browseHeadword.mockResolvedValue({
      headword: 'Ida',
      entries: [],
      selected_lemma_uuid: null,
      is_fallback: true,
    });
    addLemmaToDeck.mockResolvedValue({});
    markLemmaKnown.mockResolvedValue({});
  });

  it('renders the story and recommendations', async () => {
    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Morning Coffee' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'Ida' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'jobb' })).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Continue Reading' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('link', { name: /On the Tram/i }),
    ).toHaveAttribute('href', '/reading/story/story-2');

    expect(
      screen.queryByRole('navigation', { name: 'Story pages' }),
    ).not.toBeInTheDocument();
  });

  it('marks a single-page story complete on first load', async () => {
    renderPage();

    await screen.findByRole('heading', { name: 'Morning Coffee' });

    await waitFor(() => {
      expect(saveReadingProgress).toHaveBeenCalledWith('story-1', 0);
    });
  });

  it('clicking a token without lemmaUuid opens lookup browse mode', async () => {
    const user = userEvent.setup();

    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Ida' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(await screen.findByText(/No definition found/i)).toBeInTheDocument();
  });

  it('clicking a lemma-backed word opens the lookup sheet in lemma mode', async () => {
    const user = userEvent.setup();

    renderPage();

    await user.click(await screen.findByRole('button', { name: 'kaffe' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'kaffe', level: 3 }),
    ).toBeInTheDocument();
  });

  it('does not render DefinitionPanel component', () => {
    renderPage();

    expect(screen.queryByTestId('definition-panel')).not.toBeInTheDocument();
  });

  it('pressing Escape closes the lookup sheet', async () => {
    const user = userEvent.setup();

    renderPage();

    await user.click(await screen.findByRole('button', { name: 'kaffe' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('shows definition content when data loads', async () => {
    const user = userEvent.setup();

    renderPage();

    await user.click(await screen.findByRole('button', { name: 'kaffe' }));

    await user.click(
      await screen.findByRole('button', {
        name: /Show Norwegian definition/i,
      }),
    );
    expect(screen.getByText('coffee as a drink')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'I already know this' }),
    ).toBeInTheDocument();
  });

  it('hides recommendations when empty', async () => {
    getReadingStoryRecommendations.mockResolvedValue({ stories: [] });

    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Morning Coffee' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Continue Reading' }),
    ).not.toBeInTheDocument();
  });

  it('shows the definition error state when data fails to load', async () => {
    const user = userEvent.setup();

    getLemmaDefinitions.mockRejectedValue(new Error('boom'));

    renderPage();

    await user.click(await screen.findByRole('button', { name: 'kaffe' }));

    expect(
      await screen.findByText('Definition unavailable.'),
    ).toBeInTheDocument();
  });

  it('test_pagination_given_multi_page_story_expect_full_size_controls', async () => {
    getReadingStory.mockResolvedValue(
      buildStoryResponse({ pageIndex: 0, totalPages: 3 }),
    );

    renderPage();

    for (const name of [/first/i, /prev/i, /next/i, /last/i, 'Page 2']) {
      expect(await screen.findByRole('button', { name })).toHaveClass('h-11');
    }
  });

  it('test_pagination_given_single_page_story_expect_no_pagination_controls', async () => {
    renderPage();

    await screen.findByRole('heading', { name: 'Morning Coffee' });

    expect(
      screen.queryByRole('navigation', { name: 'Story pages' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/^Page 1 of 1$/)).not.toBeInTheDocument();
  });

  it('navigates between pages and saves progress for next and previous', async () => {
    const user = userEvent.setup();

    getReadingStory.mockImplementation(async (_uuid: string, page?: number) =>
      page === 1
        ? buildStoryResponse({
            pageIndex: 1,
            totalPages: 2,
            lastPageIndex: 1,
            completed: true,
            content:
              'Senere går Ida hjem igjen.\n\nHun hører regnet mot vinduet og lager mer te.',
          })
        : buildStoryResponse({
            pageIndex: 0,
            totalPages: 2,
            lastPageIndex: 0,
            completed: false,
          }),
    );

    renderPage();

    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /prev/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'igjen' })).toBeInTheDocument();
    expect(saveReadingProgress).toHaveBeenCalledWith('story-1', 1);
    expect(screen.getByRole('button', { name: /prev/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /prev/i }));

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    });
    expect(saveReadingProgress).toHaveBeenCalledWith('story-1', 0);
    expect(saveReadingProgress).toHaveBeenCalledTimes(2);
  });

  it('does not save completion when loading the last page fails', async () => {
    const user = userEvent.setup();

    getReadingStory.mockImplementation(async (_uuid: string, page?: number) => {
      if (page === 1) {
        throw new Error('page failed');
      }

      return buildStoryResponse({
        pageIndex: 0,
        totalPages: 2,
        lastPageIndex: 0,
        completed: false,
      });
    });

    renderPage();

    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /next/i }));

    expect(
      await screen.findByText('Could not load this story.'),
    ).toBeInTheDocument();
    expect(saveReadingProgress).not.toHaveBeenCalled();
  });

  it('shows recommendations on the last page when completed', async () => {
    const user = userEvent.setup();

    getReadingStory.mockImplementation(async (_uuid: string, page?: number) =>
      page === 1
        ? buildStoryResponse({
            pageIndex: 1,
            totalPages: 2,
            lastPageIndex: 1,
            completed: true,
            content:
              'Senere går Ida hjem igjen.\n\nHun hører regnet mot vinduet og lager mer te.',
          })
        : buildStoryResponse({
            pageIndex: 0,
            totalPages: 2,
            lastPageIndex: 0,
            completed: false,
          }),
    );

    renderPage();

    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /next/i }));

    expect(
      await screen.findByRole('heading', { name: /continue reading/i }),
    ).toBeInTheDocument();
  });

  it('adds word to deck from lookup', async () => {
    const user = userEvent.setup();

    getReadingStory.mockResolvedValue(
      buildStoryResponse({
        pageIndex: 0,
        totalPages: 1,
        lastPageIndex: 0,
        completed: true,
      }),
    );

    renderPage();

    await user.click(await screen.findByRole('button', { name: 'kaffe' }));

    expect(
      await screen.findByRole('heading', { name: 'kaffe', level: 3 }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /add to review/i }));

    await waitFor(() => {
      expect(addLemmaToDeck).toHaveBeenCalled();
      expect(addLemmaToDeck.mock.calls[0][0]).toBe('lemma-kaffe');
    });
  });

  it('test_reader_given_import_story_with_null_cefr_and_group_expect_no_badge_or_group', async () => {
    getReadingStory.mockResolvedValue({
      uuid: 'import-1',
      title: 'Imported article',
      cefrLevel: null,
      groupKey: null,
      groupTitle: null,
      page: {
        index: 0,
        content:
          'Ida lager kaffe tidlig.\n\nHun sitter ved vinduet og leser avisen før jobb.',
        tokens: buildStoryTokens(
          'Ida lager kaffe tidlig.\n\nHun sitter ved vinduet og leser avisen før jobb.',
        ),
      },
      totalPages: 1,
      lastPageIndex: 0,
      completed: false,
      userStates: {
        'lemma-lager': 'new',
        'lemma-kaffe': 'new',
      },
    });
    getReadingStoryRecommendations.mockResolvedValue({ stories: [] });

    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Imported article' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'kaffe' })).toBeInTheDocument();

    expect(screen.queryByText('Daily Life')).not.toBeInTheDocument();
    expect(screen.queryByText('A1')).not.toBeInTheDocument();
    expect(screen.queryByText('A2')).not.toBeInTheDocument();
    expect(screen.queryByText('B1')).not.toBeInTheDocument();
    expect(screen.queryByText('B2')).not.toBeInTheDocument();
  });

  it('test_reader_given_import_not_ready_409_expect_still_processing_state', async () => {
    getReadingStory.mockRejectedValue(notReadyImportError());

    renderPage();

    expect(
      await screen.findByRole('heading', {
        name: 'Still processing this text',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Check again' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Page 1 of/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'kaffe' }),
    ).not.toBeInTheDocument();
  });

  it('test_reader_given_not_ready_state_expect_check_again_button_refetches', async () => {
    const user = userEvent.setup();
    getReadingStory
      .mockRejectedValueOnce(notReadyImportError())
      .mockResolvedValueOnce(buildStoryResponse({ pageIndex: 0 }));

    renderPage();

    const checkAgain = await screen.findByRole('button', {
      name: 'Check again',
    });
    await user.click(checkAgain);

    expect(
      await screen.findByRole('heading', { name: 'Morning Coffee' }),
    ).toBeInTheDocument();
  });
  it('test_reader_given_page_search_value_expect_that_page_requested', async () => {
    getReadingStory.mockImplementation(async (_uuid: string, page?: number) =>
      buildStoryResponse({ pageIndex: page ?? 0, totalPages: 12 }),
    );

    renderPage(3);

    expect(await screen.findByText('Page 3 of 12')).toBeInTheDocument();
    expect(getReadingStory).toHaveBeenCalledWith(
      'story-1',
      2,
      expect.any(AbortSignal),
    );
    expect(
      await screen.findByRole('button', { name: 'Page 3' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('test_pagination_given_numbered_control_expect_navigation_to_that_page', async () => {
    const user = userEvent.setup();
    getReadingStory.mockImplementation(async (_uuid: string, page?: number) =>
      buildStoryResponse({ pageIndex: page ?? 0, totalPages: 12 }),
    );

    const { onNavigate } = renderPage(1);

    await user.click(await screen.findByRole('button', { name: 'Page 5' }));

    expect(onNavigate).toHaveBeenCalledWith(5);
    expect(await screen.findByText('Page 5 of 12')).toBeInTheDocument();
    expect(getReadingStory).toHaveBeenCalledWith(
      'story-1',
      4,
      expect.any(AbortSignal),
    );
  });

  it('test_pagination_given_forward_ellipsis_expect_three_page_jump', async () => {
    const user = userEvent.setup();
    getReadingStory.mockImplementation(async (_uuid: string, page?: number) =>
      buildStoryResponse({ pageIndex: page ?? 0, totalPages: 12 }),
    );

    renderPage(5);

    await user.click(
      await screen.findByRole('button', { name: 'Jump forward 3 pages' }),
    );

    expect(await screen.findByText('Page 8 of 12')).toBeInTheDocument();
  });

  it('test_pagination_given_last_control_expect_end_controls_disabled', async () => {
    const user = userEvent.setup();
    getReadingStory.mockImplementation(async (_uuid: string, page?: number) =>
      buildStoryResponse({
        pageIndex: page ?? 0,
        totalPages: 12,
        lastPageIndex: page ?? 0,
      }),
    );

    renderPage(1);

    expect(
      await screen.findByRole('button', { name: /first/i }),
    ).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /last/i }));

    expect(await screen.findByText('Page 12 of 12')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /last/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /first/i })).toBeEnabled();
  });

  it('test_reader_given_page_change_expect_focus_moves_to_story_body', async () => {
    const user = userEvent.setup();
    getReadingStory.mockImplementation(async (_uuid: string, page?: number) =>
      buildStoryResponse({ pageIndex: page ?? 0, totalPages: 12 }),
    );

    renderPage(1);

    const article = await screen.findByRole('article');
    expect(article).not.toHaveFocus();

    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => expect(article).toHaveFocus());
  });

  it('test_reader_given_pending_page_expect_busy_article_and_no_early_announcement', async () => {
    const user = userEvent.setup();
    let releaseSecondPage = () => {};
    getReadingStory.mockImplementation(async (_uuid: string, page?: number) => {
      if (page === 1) {
        await new Promise<void>((resolve) => {
          releaseSecondPage = resolve;
        });
      }
      return buildStoryResponse({ pageIndex: page ?? 0, totalPages: 2 });
    });

    renderPage(1);

    const article = await screen.findByRole('article');
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => expect(article).toHaveAttribute('aria-busy', 'true'));
    expect(screen.queryByText('Page 2 of 2')).not.toBeInTheDocument();

    releaseSecondPage();

    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument();
    await waitFor(() => expect(article).toHaveAttribute('aria-busy', 'false'));
  });

  it('test_reader_given_settled_page_expect_only_adjacent_pages_prefetched', async () => {
    getReadingStory.mockImplementation(async (_uuid: string, page?: number) =>
      buildStoryResponse({ pageIndex: page ?? 0, totalPages: 12 }),
    );

    renderPage(5);

    await screen.findByText('Page 5 of 12');

    await waitFor(() => {
      expect(getReadingStory).toHaveBeenCalledWith(
        'story-1',
        5,
        expect.any(AbortSignal),
      );
    });
    const requested = getReadingStory.mock.calls.map((call) => call[1]);
    expect(new Set(requested)).toEqual(new Set([3, 4, 5]));
  });

  it('test_reader_given_first_page_expect_only_next_page_prefetched', async () => {
    getReadingStory.mockImplementation(async (_uuid: string, page?: number) =>
      buildStoryResponse({ pageIndex: page ?? 0, totalPages: 3 }),
    );

    renderPage(1);

    await screen.findByText('Page 1 of 3');

    await waitFor(() => {
      expect(getReadingStory).toHaveBeenCalledWith(
        'story-1',
        1,
        expect.any(AbortSignal),
      );
    });
    const requested = getReadingStory.mock.calls.map((call) => call[1]);
    expect(new Set(requested)).toEqual(new Set([0, 1]));
  });

  it('test_ask_flyt_given_open_story_expect_story_and_page_context', async () => {
    getReadingStory.mockImplementation(async (_uuid: string, page?: number) =>
      buildStoryResponse({ pageIndex: page ?? 0, totalPages: 12 }),
    );

    renderPage(2);

    const probe = await screen.findByTestId('chatbot-page-context');
    await waitFor(() =>
      expect(probe).toHaveAttribute(
        'data-context',
        'reading|Morning Coffee|Page 2 of 12',
      ),
    );
  });

  it('test_recommendations_given_page_before_last_expect_hidden', async () => {
    getReadingStory.mockImplementation(async (_uuid: string, page?: number) =>
      buildStoryResponse({ pageIndex: page ?? 0, totalPages: 12 }),
    );

    renderPage(2);

    await screen.findByText('Page 2 of 12');
    expect(
      screen.queryByRole('heading', { name: 'Continue Reading' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/reached the end of this story/i),
    ).not.toBeInTheDocument();
  });

  it('test_recommendations_given_last_page_without_stories_expect_end_note_only', async () => {
    getReadingStoryRecommendations.mockResolvedValue({ stories: [] });
    getReadingStory.mockImplementation(async (_uuid: string, page?: number) =>
      buildStoryResponse({ pageIndex: page ?? 0, totalPages: 3 }),
    );

    renderPage(3);

    expect(
      await screen.findByText(/reached the end of this story/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Continue Reading' }),
    ).not.toBeInTheDocument();
  });
  it('test_end_section_given_navigation_away_from_last_page_expect_hidden_while_pending', async () => {
    const user = userEvent.setup();
    let releaseFirstPage = () => {};
    const firstPagePending = new Promise<void>((resolve) => {
      releaseFirstPage = resolve;
    });
    getReadingStory.mockImplementation(async (_uuid: string, page?: number) => {
      if (page === 0) await firstPagePending;
      return buildStoryResponse({
        pageIndex: page ?? 1,
        totalPages: 2,
        lastPageIndex: 1,
        completed: true,
      });
    });

    renderPage(2);

    expect(
      await screen.findByText(/reached the end of this story/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /prev/i }));

    const article = await screen.findByRole('article');
    await waitFor(() => expect(article).toHaveAttribute('aria-busy', 'true'));
    expect(
      screen.queryByText(/reached the end of this story/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Continue Reading' }),
    ).not.toBeInTheDocument();

    releaseFirstPage();

    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument();
    expect(
      screen.queryByText(/reached the end of this story/i),
    ).not.toBeInTheDocument();
  });

  it('test_progress_autosave_given_failed_save_expect_no_immediate_retry', async () => {
    saveReadingProgress.mockRejectedValue(new Error('save failed'));
    getReadingStory.mockImplementation(async (_uuid: string, page?: number) =>
      buildStoryResponse({
        pageIndex: page ?? 1,
        totalPages: 2,
        lastPageIndex: 1,
      }),
    );

    renderPage(2);

    await waitFor(() => expect(saveReadingProgress).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(saveReadingProgress).toHaveBeenCalledTimes(1);
  });
  it('test_progress_autosave_given_failed_save_expect_retry_on_returning_to_page', async () => {
    const user = userEvent.setup();
    saveReadingProgress.mockRejectedValueOnce(new Error('save failed'));
    getReadingStory.mockImplementation(async (_uuid: string, page?: number) =>
      buildStoryResponse({
        pageIndex: page ?? 1,
        totalPages: 2,
        lastPageIndex: 1,
      }),
    );

    renderPage(2);

    await waitFor(() =>
      expect(saveReadingProgress).toHaveBeenCalledWith('story-1', 1),
    );

    await user.click(screen.getByRole('button', { name: /prev/i }));
    await screen.findByText('Page 1 of 2');
    await user.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByText('Page 2 of 2');

    await waitFor(() =>
      expect(
        saveReadingProgress.mock.calls.filter((call) => call[1] === 1),
      ).toHaveLength(2),
    );
  });
});
