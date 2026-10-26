import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState, type ReactNode } from 'react';
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';

import {
  ChatbotProvider,
  useChatbot,
} from '@/components/chatbot/ChatbotProvider';
import { LookupProvider } from '@/components/lookup/LookupProvider';
import { useLookupContext } from '@/components/lookup/useLookupContext';
import { readingKeys } from '@/hooks/reading/queries';

import { StoryReaderPage } from './StoryReaderPage';

const viewportState = vi.hoisted(() => ({ isDesktop: false }));

vi.mock('@/hooks/ui/useIsDesktop', () => ({
  useIsDesktop: () => viewportState.isDesktop,
}));

interface RouterState {
  location: { pathname: string };
}

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params,
    to,
    ...props
  }: {
    children: ReactNode;
    params?: Record<string, string>;
    to: string;
    [key: string]: unknown;
  }): ReactNode => {
    let href = to;
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        href = href.replace(`$${key}`, value);
      }
    }
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
  useRouterState: ({ select }: { select: (s: RouterState) => string }) =>
    select({ location: { pathname: '/reading/story/story-1' } }),
  useMatch: () => ({ id: '/_reader/reading/story/$uuid' }),
}));

const {
  addLemmaToDeck,
  browseHeadword,
  getLemmaDefinitions,
  getReadingHome,
  getReadingStories,
  getReadingStory,
  getReadingStoryRecommendations,
  markLemmaKnown,
  saveReadingProgress,
} = vi.hoisted(() => ({
  addLemmaToDeck: vi.fn(),
  browseHeadword: vi.fn(),
  getLemmaDefinitions: vi.fn(),
  getReadingHome: vi.fn(),
  getReadingStories: vi.fn(),
  getReadingStory: vi.fn(),
  getReadingStoryRecommendations: vi.fn(),
  markLemmaKnown: vi.fn(),
  saveReadingProgress: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/api/reading', () => ({
  getReadingHome,
  getReadingStories,
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
  externalControls = false,
}: {
  initialPage?: number;
  onNavigate: (page: number) => void;
  externalControls?: boolean;
}) {
  const [page, setPage] = useState(initialPage);

  return (
    <>
      {externalControls && (
        <>
          <button onClick={() => setPage(1)}>History back</button>
          <button onClick={() => setPage(2)}>History forward</button>
          <DictionarySelectionControl />
        </>
      )}
      <StoryReaderPage
        page={page}
        onPageChange={(next) => {
          onNavigate(next);
          setPage(next);
        }}
        storyUuid="story-1"
      />
    </>
  );
}

function DictionarySelectionControl() {
  const { openLemma } = useLookupContext();
  return (
    <button onClick={() => openLemma('lemma-kaffe', 'kaffe')}>
      Select dictionary word
    </button>
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

function renderPage(initialPage?: number, externalControls = false) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const onNavigate = vi.fn();

  return {
    onNavigate,
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <ChatbotProvider accountId={7}>
          <LookupProvider>
            <ReaderUrlHarness
              initialPage={initialPage}
              onNavigate={onNavigate}
              externalControls={externalControls}
            />
            <ChatbotContextProbe />
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

function buildDifficultyResponse(newCount: number, totalCount: number) {
  return {
    ...buildStoryResponse({
      pageIndex: 0,
      content: [
        ...Array<string>(newCount).fill('kaffe'),
        ...Array<string>(totalCount - newCount).fill('tidlig'),
      ].join(' '),
    }),
    cefrLevel: 'B1',
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

function expectPage(page: number, total: number) {
  expect(screen.getByRole('progressbar')).toHaveAttribute(
    'aria-valuetext',
    `Page ${page} of ${total}`,
  );
}

async function waitForPage(page: number, total: number) {
  await waitFor(() => expectPage(page, total));
}

describe('StoryReaderPage', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    viewportState.isDesktop = false;
    window.localStorage.clear();
    saveReadingProgress.mockResolvedValue(undefined);
    getReadingHome.mockResolvedValue({ todaysStory: null, sections: [] });
    getReadingStories.mockResolvedValue({
      group: {
        id: 1,
        key: 'daily_life',
        title: 'Hverdagsliv',
        order: 1,
        storyCount: 1,
      },
      stories: [],
      nextCursor: null,
      totalCount: 0,
      levelCounts: {},
    });
    getReadingStory.mockResolvedValue(buildStoryResponse({ pageIndex: 0 }));
    getReadingStoryRecommendations.mockResolvedValue({
      stories: [
        {
          uuid: 'story-2',
          title: 'On the Tram',
          cefrLevel: 'A2',
          createdAt: '2026-04-10T07:00:00Z',
          wordCount: 198,
          isRead: false,
          completed: false,
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
          examples: [],
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

  it('test_easier_notice_given_twelve_new_words_at_forty_percent_expect_notice_for_repeated_words', async () => {
    getReadingStory.mockResolvedValue(buildDifficultyResponse(12, 30));
    renderPage(1);
    expect(
      await screen.findByText('12 words on this page are new to you.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Show A2 stories in Daily Life' }),
    ).toBeInTheDocument();
  });

  it('test_easier_notice_given_more_than_forty_percent_but_eleven_new_words_expect_no_notice', async () => {
    getReadingStory.mockResolvedValue(buildDifficultyResponse(11, 20));
    renderPage(1);
    await waitForPage(1, 1);
    expect(
      screen.queryByText(/words on this page are new to you/),
    ).not.toBeInTheDocument();
  });

  it('test_easier_notice_given_twelve_unresolved_new_words_expect_notice_without_dictionary_entries', async () => {
    getReadingStory.mockResolvedValue({
      ...buildDifficultyResponse(12, 30),
      page: {
        index: 0,
        content: Array<string>(12).fill('ukjent').join(' '),
        tokens: Array.from({ length: 12 }, (_, index) => ({
          word: 'ukjent',
          start: index * 7,
          end: index * 7 + 6,
          lemmaUuid: null,
        })),
      },
    });
    renderPage(1);
    expect(
      await screen.findByText('12 words on this page are new to you.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('New 12')).not.toBeInTheDocument();
  });

  it('test_easier_notice_given_twelve_new_words_below_forty_percent_expect_no_notice', async () => {
    getReadingStory.mockResolvedValue(buildDifficultyResponse(12, 31));
    renderPage(1);
    await waitForPage(1, 1);
    expect(
      screen.queryByText(/words on this page are new to you/),
    ).not.toBeInTheDocument();
  });

  it('test_easier_notice_given_keep_reading_on_difficult_page_expect_notice_dismissed', async () => {
    getReadingStory.mockResolvedValue(buildDifficultyResponse(12, 30));
    renderPage(1);
    const dismiss = await screen.findAllByRole('button', {
      name: 'Keep reading',
    });
    await userEvent.setup().click(dismiss[0]);
    expect(
      screen.queryByText(/words on this page are new to you/),
    ).not.toBeInTheDocument();
  });

  it('test_reader_given_first_page_expect_header_legend_and_next_without_previous', async () => {
    getReadingStory.mockResolvedValue(
      buildStoryResponse({ pageIndex: 0, totalPages: 3 }),
    );
    renderPage(1);
    await waitForPage(1, 3);
    expect(
      screen.getByRole('heading', { name: 'Morning Coffee' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Back to Reading' }),
    ).toHaveAttribute('href', '/reading');
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled();
    expect(
      screen.queryByRole('button', { name: 'Previous page' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: 'Word states' }),
    ).toHaveTextContent('New 4Learning 1');
    expect(
      screen.queryByRole('heading', { name: 'Continue reading' }),
    ).not.toBeInTheDocument();
  });

  it('test_reader_given_single_page_expect_finish_without_automatic_completion', async () => {
    renderPage();
    await waitForPage(1, 1);
    expect(screen.getByRole('button', { name: 'Finish story' })).toBeEnabled();
    expect(saveReadingProgress).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('heading', { name: 'Story finished' }),
    ).not.toBeInTheDocument();
  });

  it('test_finish_given_unsaved_last_page_expect_save_then_end_and_recommendations', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(
      await screen.findByRole('button', { name: 'Finish story' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Story finished' }),
    ).toBeInTheDocument();
    expect(saveReadingProgress).toHaveBeenCalledWith('story-1', 0);
    expect(
      screen.queryByRole('link', { name: 'Next story' }),
    ).not.toBeInTheDocument();
    const recommendation = screen.getByRole('link', { name: /On the Tram/ });
    expect(recommendation).toHaveAttribute('href', '/reading/story/story-2');
    expect(recommendation).toHaveTextContent(/^A2On the Tram198 words$/);
    expect(
      screen.getByRole('heading', { name: 'More to read' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/looked up/i)).not.toBeInTheDocument();
    expect(screen.getByText('Daily Life · 1 page')).toBeInTheDocument();
    expect(
      screen.queryByText(/^Daily Life · 1 page ·/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Practise/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('article')).toHaveFocus();
  });

  it('test_completion_given_repeated_inflected_lookup_expect_one_dictionary_chip_reopening_context', async () => {
    const user = userEvent.setup();
    getLemmaDefinitions.mockResolvedValue({
      lemma: {
        uuid: 'lemma-sitte',
        word: 'sitte',
        pos: 'verb',
        primary_translation: null,
      },
      definitions: [
        {
          uuid: 'definition-sitte',
          translation: null,
          translation_source: null,
          examples: [],
          userState: 'new',
        },
      ],
    });
    renderPage();
    for (let visit = 0; visit < 2; visit++) {
      await user.click(await screen.findByRole('button', { name: 'sitter' }));
      await screen.findByText('No translation found');
      await user.click(
        screen.getByRole('button', { name: 'Close word lookup' }),
      );
    }
    await user.click(screen.getByRole('button', { name: 'Finish story' }));
    await screen.findByRole('heading', { name: 'Story finished' });
    expect(
      await screen.findByRole('heading', { name: 'Words you looked up 1' }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: 'Look up sitte' }),
    ).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Look up sitte' }));
    expect(
      await screen.findByText(
        'Hun sitter ved vinduet og leser avisen før jobb.',
      ),
    ).toBeInTheDocument();
  });

  it('test_completion_given_invalidated_cached_pages_and_prose_observer_expect_no_focus_or_reconnect_fetch', async () => {
    const user = userEvent.setup();
    const { queryClient } = renderPage();
    await user.click(
      await screen.findByRole('button', { name: 'Finish story' }),
    );
    await screen.findByRole('heading', { name: 'Story finished' });
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    const requests = getReadingStory.mock.calls.length;
    await act(async () => {
      await queryClient.invalidateQueries({
        queryKey: readingKeys.story('story-1'),
        refetchType: 'none',
      });
      focusManager.setFocused(false);
      focusManager.setFocused(true);
      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
    });
    expect(getReadingStory).toHaveBeenCalledTimes(requests);
    expect(
      screen.getByRole('progressbar', { name: 'Mastered words' }),
    ).toBeInTheDocument();
  });

  it('test_completion_given_lookup_on_earlier_page_expect_visit_history_retained', async () => {
    const user = userEvent.setup();
    getLemmaDefinitions.mockResolvedValue({
      lemma: {
        uuid: 'lemma-kaffe',
        word: 'kaffe',
        pos: 'noun',
        primary_translation: null,
      },
      definitions: [
        {
          uuid: 'definition-kaffe',
          definition: '',
          translation: null,
          examples: [],
          userState: 'new',
        },
      ],
    });
    getReadingStory.mockImplementation(async (_uuid, index) =>
      buildStoryResponse({
        pageIndex: index ?? 0,
        totalPages: 2,
        content:
          index === 1 ? 'Hun lager kaffe igjen.' : 'Ida lager kaffe tidlig.',
      }),
    );
    renderPage(1);
    await user.click(await screen.findByRole('button', { name: 'kaffe' }));
    await screen.findByText('No translation found');
    await user.click(screen.getByRole('button', { name: 'Close word lookup' }));
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await waitForPage(2, 2);
    await user.click(screen.getByRole('button', { name: 'Finish story' }));
    expect(
      await screen.findByRole('button', { name: 'Look up kaffe' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Look up kaffe' }));
    expect(await screen.findByText('Ida lager kaffe tidlig.')).toBeVisible();
    expect(
      screen.queryByText('Hun lager kaffe igjen.'),
    ).not.toBeInTheDocument();
  });

  it('test_completion_given_authored_theme_list_expect_real_word_count_and_first_unread_destination', async () => {
    const user = userEvent.setup();
    getReadingStories.mockResolvedValue({
      group: {
        id: 1,
        key: 'daily_life',
        title: 'Daily Life',
        order: 1,
        storyCount: 3,
      },
      stories: [
        {
          uuid: 'story-1',
          title: 'Morning Coffee',
          cefrLevel: 'A1',
          wordCount: 640,
          createdAt: '2026-10-01T00:00:00',
          isRead: true,
          completed: false,
        },
        {
          uuid: 'read',
          title: 'Already read',
          cefrLevel: 'A1',
          wordCount: 580,
          createdAt: '2026-10-01T00:00:00',
          isRead: true,
          completed: true,
        },
        {
          uuid: 'unread',
          title: 'Read this next',
          cefrLevel: 'A2',
          wordCount: 580,
          createdAt: '2026-10-01T00:00:00',
          isRead: false,
          completed: false,
        },
      ],
      nextCursor: null,
      totalCount: 3,
      levelCounts: {},
    });
    renderPage();
    await user.click(
      await screen.findByRole('button', { name: 'Finish story' }),
    );
    expect(
      await screen.findByRole('link', { name: 'Read next story' }),
    ).toHaveAttribute('href', '/reading/story/unread');
    expect(
      screen.getByText('Daily Life · 1 page · 640 words'),
    ).toBeInTheDocument();
  });

  it('test_completion_given_missing_page_failure_expect_no_partial_summary_and_retry', async () => {
    const user = userEvent.setup();
    getReadingStory.mockImplementation(async (_uuid, index) => {
      if (index === 0) throw new Error('Page unavailable');
      return buildStoryResponse({ pageIndex: 1, totalPages: 2 });
    });
    renderPage(2);
    await user.click(
      await screen.findByRole('button', { name: 'Finish story' }),
    );
    await screen.findByText("The story's word summary couldn't load.");
    expect(
      screen.queryByRole('progressbar', { name: 'Mastered words' }),
    ).not.toBeInTheDocument();
    getReadingStory.mockImplementation(async (_uuid, index) =>
      buildStoryResponse({ pageIndex: index ?? 0, totalPages: 2 }),
    );
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('progressbar', { name: 'Mastered words' }),
    ).toBeInTheDocument();
  });

  it('test_finish_given_save_in_flight_expect_busy_controls_and_no_end', async () => {
    const user = userEvent.setup();
    let release = () => {};
    saveReadingProgress.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    renderPage();
    await user.click(
      await screen.findByRole('button', { name: 'Finish story' }),
    );
    expect(screen.getByRole('button', { name: 'Finish story' })).toBeDisabled();
    expect(
      screen.queryByRole('heading', { name: 'Story finished' }),
    ).not.toBeInTheDocument();
    release();
    expect(
      await screen.findByRole('heading', { name: 'Story finished' }),
    ).toBeInTheDocument();
  });

  it('test_finish_given_failed_save_expect_reader_stays_open_and_retry_succeeds', async () => {
    const user = userEvent.setup();
    saveReadingProgress.mockRejectedValueOnce(new Error('save failed'));
    renderPage();
    await user.click(
      await screen.findByRole('button', { name: 'Finish story' }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Finish story' }),
      ).toBeEnabled(),
    );
    expect(saveReadingProgress).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole('heading', { name: 'Story finished' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Finish story' }));
    expect(
      await screen.findByRole('heading', { name: 'Story finished' }),
    ).toBeInTheDocument();
    expect(saveReadingProgress).toHaveBeenCalledTimes(2);
  });

  it('test_finish_given_already_completed_story_expect_end_without_duplicate_save', async () => {
    const user = userEvent.setup();
    getReadingStory.mockResolvedValue(
      buildStoryResponse({ pageIndex: 0, completed: true }),
    );
    renderPage();
    await user.click(
      await screen.findByRole('button', { name: 'Finish story' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Story finished' }),
    ).toBeInTheDocument();
    expect(saveReadingProgress).not.toHaveBeenCalled();
  });

  it('test_completion_given_history_round_trip_expect_last_page_prose', async () => {
    getReadingStory.mockImplementation((_uuid, pageIndex) =>
      Promise.resolve(
        buildStoryResponse({
          pageIndex: pageIndex ?? 1,
          totalPages: 2,
          completed: true,
        }),
      ),
    );
    const user = userEvent.setup();
    renderPage(2, true);
    await user.click(
      await screen.findByRole('button', { name: 'Finish story' }),
    );
    await screen.findByRole('heading', { name: 'Story finished' });
    await user.click(screen.getByRole('button', { name: 'History back' }));
    await waitForPage(1, 2);
    await user.click(screen.getByRole('button', { name: 'History forward' }));
    await waitForPage(2, 2);
    expect(
      screen.queryByRole('heading', { name: 'Story finished' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish story' })).toBeEnabled();
  });

  it('test_page_transition_given_open_lookup_and_reused_word_expect_new_article_focused', async () => {
    getReadingStory.mockImplementation((_uuid, pageIndex) =>
      Promise.resolve(
        buildStoryResponse({ pageIndex: pageIndex ?? 1, totalPages: 2 }),
      ),
    );
    const user = userEvent.setup();
    renderPage(2, true);
    const historyBack = screen.getByRole('button', { name: 'History back' });
    await user.click(await screen.findByRole('button', { name: 'kaffe' }));
    await screen.findByRole('dialog');
    fireEvent.click(historyBack);
    await waitForPage(1, 2);
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(screen.getByRole('article')).toHaveFocus());
  });

  it('test_completion_given_finish_response_after_history_round_trip_expect_prose_until_new_finish', async () => {
    getReadingStory.mockImplementation((_uuid, pageIndex) =>
      Promise.resolve(
        buildStoryResponse({ pageIndex: pageIndex ?? 1, totalPages: 2 }),
      ),
    );
    let release = () => {};
    saveReadingProgress.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const user = userEvent.setup();
    renderPage(2, true);
    await user.click(
      await screen.findByRole('button', { name: 'Finish story' }),
    );
    await user.click(screen.getByRole('button', { name: 'History back' }));
    await waitForPage(1, 2);
    await user.click(screen.getByRole('button', { name: 'History forward' }));
    await waitForPage(2, 2);
    release();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Finish story' }),
      ).toBeEnabled(),
    );
    expect(
      screen.queryByRole('heading', { name: 'Story finished' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Finish story' }));
    expect(
      await screen.findByRole('heading', { name: 'Story finished' }),
    ).toBeInTheDocument();
  });

  it('test_completion_given_dictionary_selection_expect_visible_definition', async () => {
    const user = userEvent.setup();
    renderPage(undefined, true);
    await user.click(
      await screen.findByRole('button', { name: 'Finish story' }),
    );
    await screen.findByRole('heading', { name: 'Story finished' });
    await user.click(
      screen.getByRole('button', { name: 'Select dictionary word' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'kaffe', level: 3 }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Back to word list' }),
    ).not.toBeInTheDocument();
  });

  it('test_reader_given_word_without_lemma_expect_sentence_reason_and_ask_flyt', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Ida' }));
    expect(await screen.findByText('No translation found')).toBeInTheDocument();
    expect(
      screen.getByText(/dialect spelling, a name or a typo/),
    ).toBeInTheDocument();
    expect(screen.getByRole('blockquote')).toHaveTextContent(
      'Ida lager kaffe tidlig.',
    );
    await user.click(
      screen.getByRole('button', { name: 'Ask Flyt what it means' }),
    );
    await waitFor(() =>
      expect(screen.getByTestId('chatbot-page-context')).toHaveAttribute(
        'data-context',
        'selection|Ida|Ida lager kaffe tidlig.',
      ),
    );
  });

  it('test_reader_given_word_lookup_expect_state_badge_and_current_word', async () => {
    const user = userEvent.setup();
    renderPage();
    const word = await screen.findByRole('button', { name: 'kaffe' });
    await user.click(word);
    expect(
      await screen.findByRole('heading', { name: 'kaffe', level: 3 }),
    ).toBeInTheDocument();
    expect(screen.getByText('New word')).toBeInTheDocument();
    expect(word).toHaveAttribute('aria-current', 'true');
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(word).not.toHaveAttribute('aria-current');
    await waitFor(() => expect(word).toHaveFocus());
  });

  it.each(['explicit', 'saved_preference'])(
    'test_reader_given_desktop_chatbot_open_expect_word_definition_and_reopenable_chatbot',
    async (openBy) => {
      viewportState.isDesktop = true;
      if (openBy === 'saved_preference')
        window.localStorage.setItem('flyt.chatbot.rail-preference:7', 'open');
      const user = userEvent.setup();
      renderPage();
      await waitForPage(1, 1);
      const trigger = screen.getByRole('button', { name: 'Ask Flyt' });
      if (openBy === 'explicit') await user.click(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await screen.findByRole('complementary', { name: 'Ask Flyt chatbot' });
      const word = screen.getByRole('button', { name: 'kaffe' });

      await user.click(word);

      expect(
        await screen.findByRole('heading', { name: 'kaffe', level: 3 }),
      ).toBeVisible();
      expect(screen.getByTestId('definition-panel')).toHaveTextContent(
        'coffee',
      );
      expect(word).toHaveAttribute('aria-current', 'true');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(
        window.localStorage.getItem('flyt.chatbot.rail-preference:7'),
      ).toBe('open');
      await user.click(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    },
  );

  it('test_completion_given_desktop_chatbot_open_expect_lookup_chip_definition', async () => {
    viewportState.isDesktop = true;
    const user = userEvent.setup();
    renderPage();
    await waitForPage(1, 1);
    const article = screen.getByRole('article');
    await user.click(within(article).getByRole('button', { name: 'kaffe' }));
    await screen.findByRole('heading', { name: 'kaffe', level: 3 });
    await user.click(screen.getByRole('button', { name: 'Finish story' }));
    await screen.findByRole('heading', { name: 'Story finished' });
    const trigger = screen.getByRole('button', { name: 'Ask Flyt' });
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getByRole('button', { name: 'Look up kaffe' }));

    expect(
      await screen.findByRole('heading', { name: 'kaffe', level: 3 }),
    ).toBeVisible();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('test_reader_given_repeated_lemma_expect_only_tapped_occurrence_current', async () => {
    getReadingStory.mockResolvedValue(
      buildStoryResponse({ pageIndex: 0, content: 'kaffe og kaffe.' }),
    );
    const user = userEvent.setup();
    renderPage();
    const words = await screen.findAllByRole('button', { name: 'kaffe' });
    await user.click(words[1]);
    expect(words[1]).toHaveAttribute('aria-current', 'true');
    expect(words[0]).not.toHaveAttribute('aria-current');
  });

  it('test_reader_given_related_dictionary_entry_expect_lookup_outside_page', async () => {
    getLemmaDefinitions.mockImplementation(async (uuid: string) =>
      uuid === 'lemma-te'
        ? {
            lemma: {
              uuid,
              word: 'te',
              pos: 'noun',
              primary_translation: 'tea',
            },
            definitions: [],
          }
        : {
            lemma: {
              uuid,
              word: 'kaffe',
              pos: 'noun',
              primary_translation: 'coffee',
              see_also: [
                {
                  article_id: 1,
                  word: 'te',
                  relation: 'compare',
                  target_lemma_uuid: 'lemma-te',
                },
              ],
            },
            definitions: [],
          },
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'kaffe' }));
    await user.click(await screen.findByRole('button', { name: 'Compare te' }));
    expect(
      await screen.findByRole('heading', { name: 'te', level: 3 }),
    ).toBeInTheDocument();
  });

  it('test_autosave_given_nonfinal_save_failure_expect_retry_after_refetch', async () => {
    getReadingStory.mockResolvedValue(
      buildStoryResponse({ pageIndex: 0, totalPages: 3 }),
    );
    saveReadingProgress.mockRejectedValueOnce(new Error('save failed'));
    const { queryClient } = renderPage(1);
    await waitFor(() => expect(saveReadingProgress).toHaveBeenCalledOnce());
    getReadingStory.mockResolvedValue(
      buildStoryResponse({
        pageIndex: 0,
        totalPages: 3,
        content: 'Ida lager kaffe igjen.',
      }),
    );
    await queryClient.invalidateQueries({
      queryKey: readingKeys.story('story-1'),
    });
    await waitFor(() => expect(saveReadingProgress).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled();
  });

  it('test_lookup_given_definition_failure_expect_retryable_error', async () => {
    const user = userEvent.setup();
    getLemmaDefinitions.mockRejectedValue(new Error('boom'));
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'kaffe' }));
    expect(
      await screen.findByText('Definition unavailable.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled();
  });

  it('test_lookup_given_add_to_review_expect_existing_lemma_action', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'kaffe' }));
    await user.click(
      await screen.findByRole('button', { name: 'Add to review' }),
    );
    await waitFor(() =>
      expect(addLemmaToDeck.mock.calls[0]?.[0]).toBe('lemma-kaffe'),
    );
  });

  it('test_reader_given_page_search_value_expect_requested_page_and_bounded_prefetch', async () => {
    getReadingStory.mockImplementation(async (_uuid: string, page?: number) =>
      buildStoryResponse({ pageIndex: page ?? 0, totalPages: 12 }),
    );
    renderPage(5);
    await waitForPage(5, 12);
    await waitFor(() =>
      expect(getReadingStory).toHaveBeenCalledWith(
        'story-1',
        5,
        expect.any(AbortSignal),
      ),
    );
    expect(new Set(getReadingStory.mock.calls.map((call) => call[1]))).toEqual(
      new Set([3, 4, 5]),
    );
  });

  it('test_reader_given_first_page_expect_only_next_page_prefetched', async () => {
    getReadingStory.mockImplementation(async (_uuid: string, page?: number) =>
      buildStoryResponse({ pageIndex: page ?? 0, totalPages: 3 }),
    );
    renderPage(1);
    await waitForPage(1, 3);
    await waitFor(() =>
      expect(getReadingStory).toHaveBeenCalledWith(
        'story-1',
        1,
        expect.any(AbortSignal),
      ),
    );
    expect(new Set(getReadingStory.mock.calls.map((call) => call[1]))).toEqual(
      new Set([0, 1]),
    );
  });

  it('test_reader_given_next_and_previous_expect_url_changes_and_nonfinal_progress_save', async () => {
    const user = userEvent.setup();
    getReadingStory.mockImplementation(async (_uuid: string, page?: number) =>
      buildStoryResponse({ pageIndex: page ?? 0, totalPages: 3 }),
    );
    const { onNavigate } = renderPage(1);
    await waitForPage(1, 3);
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await waitForPage(2, 3);
    expect(onNavigate).toHaveBeenCalledWith(2);
    expect(saveReadingProgress).toHaveBeenCalledWith('story-1', 1);
    await user.click(screen.getByRole('button', { name: 'Previous page' }));
    await waitForPage(1, 3);
    expect(onNavigate).toHaveBeenCalledWith(1);
    expect(screen.getByRole('article')).toHaveFocus();
  });

  it('test_reader_given_pending_page_expect_previous_prose_busy_and_no_early_announcement', async () => {
    const user = userEvent.setup();
    let release = () => {};
    getReadingStory.mockImplementation(async (_uuid: string, page?: number) => {
      if (page === 1)
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      return buildStoryResponse({ pageIndex: page ?? 0, totalPages: 2 });
    });
    renderPage(1);
    await waitForPage(1, 2);
    const article = screen.getByRole('article');
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(article).toHaveAttribute('aria-busy', 'true'));
    expect(
      screen.getByRole('status', { name: 'Current story page' }),
    ).toHaveTextContent('');
    expect(screen.getByRole('button', { name: 'kaffe' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish story' })).toBeDisabled();
    release();
    await waitForPage(2, 2);
    expect(article).toHaveAttribute('aria-busy', 'false');
  });

  it('test_reader_given_failed_last_page_load_expect_no_completion_save', async () => {
    const user = userEvent.setup();
    getReadingStory.mockImplementation(async (_uuid: string, page?: number) => {
      if (page === 1) throw new Error('failed');
      return buildStoryResponse({ pageIndex: 0, totalPages: 2 });
    });
    renderPage();
    await waitForPage(1, 2);
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(
      await screen.findByText("Couldn't open this story"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Back to Reading' }),
    ).toBeInTheDocument();
    expect(saveReadingProgress).not.toHaveBeenCalled();
  });

  it('test_reader_given_pending_initial_load_expect_skeleton_status_and_back', () => {
    getReadingStory.mockImplementation(() => new Promise(() => {}));
    renderPage();
    expect(
      screen.getByRole('status', { name: 'Loading story' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Back to Reading' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('test_reader_given_import_not_ready_expect_preparation_explanation_and_imports_exit', async () => {
    getReadingStory.mockRejectedValue(notReadyImportError());
    renderPage();
    expect(
      await screen.findByRole('heading', { name: 'Still preparing this text' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Back to your imports' }),
    ).toHaveAttribute('href', '/reading/imports');
    expect(
      screen.queryByRole('button', { name: 'Finish story' }),
    ).not.toBeInTheDocument();
  });

  it('test_reader_given_import_without_group_or_level_expect_metadata_absent', async () => {
    getReadingStory.mockResolvedValue({
      ...buildStoryResponse({ pageIndex: 0 }),
      cefrLevel: null,
      groupTitle: null,
      groupKey: null,
    });
    renderPage();
    await waitForPage(1, 1);
    expect(screen.queryByText('Daily Life')).not.toBeInTheDocument();
    expect(screen.queryByText('A1')).not.toBeInTheDocument();
  });

  it('test_chatbot_given_reading_page_expect_title_and_settled_page_context', async () => {
    getReadingStory.mockResolvedValue(
      buildStoryResponse({ pageIndex: 1, totalPages: 3 }),
    );
    renderPage(2);
    await waitFor(() =>
      expect(screen.getByTestId('chatbot-page-context')).toHaveAttribute(
        'data-context',
        'reading|Morning Coffee|Page 2 of 3',
      ),
    );
  });
});
