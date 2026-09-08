import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
  // LookupSheet matches the reader leaf route; return a truthy match so the
  // component sees the same router state the real story URL would produce.
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

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <LookupProvider>
        <StoryReaderPage storyUuid="story-1" />
        <LookupSheet />
      </LookupProvider>
    </QueryClientProvider>,
  );
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

    expect(screen.getByText(/Page 1 of 1/)).toBeInTheDocument();
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

    // The old DefinitionPanel component should not exist
    // Since we're using LookupSheet now, there should be no references to DefinitionPanel
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

  it('renders pagination controls as full-size accessible buttons', async () => {
    renderPage();

    const previous = await screen.findByRole('button', { name: /prev/i });
    const next = await screen.findByRole('button', { name: /next/i });

    expect(previous).toHaveClass('h-11');
    expect(next).toHaveClass('h-11');
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
    // D-001/R-004: imports return null cefrLevel/groupKey/groupTitle; the
    // reader must render without a CEFR Badge or group caption, and keep
    // identical word decoration to curated.
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
    // Hide recommendations so the A1/A2 cover bands from the curated
    // "Continue Reading" cards don't pollute the assertion below.
    getReadingStoryRecommendations.mockResolvedValue({ stories: [] });

    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Imported article' }),
    ).toBeInTheDocument();
    // Decoration still renders (R-004): the lemma-backed word is a button.
    expect(screen.getByRole('button', { name: 'kaffe' })).toBeInTheDocument();

    // No group caption. With recommendations hidden above, the only place
    // a CEFR level string (A1/A2/B1/B2) could appear is the reader header
    // badge; assert none of them render.
    expect(screen.queryByText('Daily Life')).not.toBeInTheDocument();
    expect(screen.queryByText('A1')).not.toBeInTheDocument();
    expect(screen.queryByText('A2')).not.toBeInTheDocument();
    expect(screen.queryByText('B1')).not.toBeInTheDocument();
    expect(screen.queryByText('B2')).not.toBeInTheDocument();
  });

  it('test_reader_given_import_not_ready_409_expect_still_processing_state', async () => {
    // R-002: a not-ready import returns 409 IMPORT_NOT_READY; the reader
    // must render the "Still processing" state and NOT mount a blank reader.
    const notReadyError = Object.assign(new Error('Request failed'), {
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
    getReadingStory.mockRejectedValue(notReadyError);

    renderPage();

    expect(
      await screen.findByRole('heading', {
        name: 'Still processing this text',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Check again' }),
    ).toBeInTheDocument();
    // The reader body (word buttons, page controls) must not mount.
    expect(screen.queryByText(/Page 1 of/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'kaffe' }),
    ).not.toBeInTheDocument();
  });

  it('test_reader_given_not_ready_state_expect_check_again_button_refetches', async () => {
    const user = userEvent.setup();
    // First load: 409. Then the import finishes and the reader mounts.
    getReadingStory
      .mockRejectedValueOnce(
        Object.assign(new Error('Request failed'), {
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
        }),
      )
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
});
