import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState, type ReactNode } from 'react';

import { LookupProvider } from '@/components/lookup/LookupProvider';
import {
  type StoryGenerationCurrentResponse,
  type StoryGenerationPage as StoryGenerationPageData,
  type StoryGenerationProvider,
  type StoryGenerationStatus,
  type StoryGenerationSurfaceResponse,
} from '@/types/api';

import { STORY_GENERATION_PROCESSING_STALL_BACKSTOP_MS } from './constants';
import {
  StoryGenerationPage,
  type StoryGenerationSearch as PageSearch,
  type StoryGenerationPageProps,
} from './StoryGenerationPage';

const mocks = vi.hoisted(() => ({
  useCreateStoryGeneration: vi.fn(),
  useCurrentStoryGeneration: vi.fn(),
  useImportCurrentStoryGeneration: vi.fn(),
  useStoryGenerationSurface: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    ...props
  }: {
    children: ReactNode;
    to: string;
  } & Record<string, unknown>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => mocks.navigate,
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({
      location: { pathname: '/reading/generate', search: {} },
    }),
}));

vi.mock('@/hooks/storyGeneration/queries', () => ({
  useCreateStoryGeneration: mocks.useCreateStoryGeneration,
  useCurrentStoryGeneration: mocks.useCurrentStoryGeneration,
  useImportCurrentStoryGeneration: mocks.useImportCurrentStoryGeneration,
  useStoryGenerationSurface: mocks.useStoryGenerationSurface,
}));

function buildProvider(
  name: string,
  overrides: Partial<StoryGenerationProvider> = {},
): StoryGenerationProvider {
  return {
    name,
    model: name === 'chatgpt' ? 'gpt-5' : 'openrouter/free',
    available: true,
    limitedByFlyt: name !== 'chatgpt',
    reason: null,
    action: null,
    remainingPercent: name === 'chatgpt' ? null : 77,
    ...overrides,
  };
}

function buildSurface({
  remainingPercent = 77,
}: {
  remainingPercent?: number | null;
} = {}): StoryGenerationSurfaceResponse {
  return {
    providers: [
      buildProvider('openrouter', { remainingPercent }),
      buildProvider('chatgpt', {
        available: false,
        limitedByFlyt: false,
        reason: 'account_not_linked',
        action: 'link_account',
        remainingPercent: null,
      }),
    ],
    anchors: [
      { type: 'frequency', available: true, reason: null },
      { type: 'deck', available: false, reason: 'deck_below_minimum' },
      { type: 'none', available: true, reason: null },
    ],
    deckCollapsesWithFrequency: false,
    minDeckSize: 100,
    lengthOptions: [150, 300],
    topicSuggestions: ['A rainy day', 'A train ride'],
  };
}

function buildReadyPage(): StoryGenerationPageData {
  return {
    index: 0,
    content: 'Solen skinner.',
    tokens: [
      { word: 'Solen', start: 0, end: 5, lemmaUuid: 'lemma-solen' },
      { word: 'skinner', start: 6, end: 13, lemmaUuid: 'lemma-skinne' },
    ],
    wordCount: 2,
  };
}

function buildCurrent(
  status: StoryGenerationStatus,
  overrides: Partial<StoryGenerationCurrentResponse> = {},
): StoryGenerationCurrentResponse {
  const isReady = status === 'ready';
  return {
    generationId: 1,
    status,
    provider: 'openrouter',
    anchor: 'frequency',
    length: 150,
    topic: 'A rainy day',
    pages: isReady ? [buildReadyPage()] : null,
    userStates: {},
    failureCode:
      status === 'refused'
        ? 'STORY_GENERATION_AGGREGATE_CEILING_REACHED'
        : status === 'failed'
          ? 'STORY_GENERATION_FAILED'
          : null,
    failureMessage:
      status === 'refused'
        ? 'The shared story capacity is full right now.'
        : status === 'failed'
          ? 'The provider did not finish the story.'
          : null,
    ...overrides,
  };
}

let surfaceResult: ReturnType<typeof buildSurfaceQuery>;
let currentResult: ReturnType<typeof buildCurrentQuery>;
let createResult: ReturnType<typeof buildMutation>;
let importResult: ReturnType<typeof buildMutation>;

function buildSurfaceQuery(data = buildSurface()) {
  return {
    data,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  };
}

function buildCurrentQuery(data: StoryGenerationCurrentResponse | null = null) {
  return {
    data,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  };
}

function buildMutation() {
  return {
    error: null as Error | null,
    isError: false,
    isPending: false,
    mutate: vi.fn(),
    reset: vi.fn(),
  };
}

function renderPage(
  search: PageSearch = {},
  onSearchChange: StoryGenerationPageProps['onSearchChange'] = vi.fn(),
) {
  return render(
    <LookupProvider>
      <StoryGenerationPage search={search} onSearchChange={onSearchChange} />
    </LookupProvider>,
  );
}

function StatefulPage() {
  const [search, setSearch] = useState<PageSearch>({});
  return (
    <StoryGenerationPage
      search={search}
      onSearchChange={(patch) =>
        setSearch((previous) => ({ ...previous, ...patch }))
      }
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  surfaceResult = buildSurfaceQuery();
  currentResult = buildCurrentQuery();
  createResult = buildMutation();
  importResult = buildMutation();
  mocks.useStoryGenerationSurface.mockImplementation(() => surfaceResult);
  mocks.useCurrentStoryGeneration.mockImplementation(() => currentResult);
  mocks.useCreateStoryGeneration.mockImplementation(() => createResult);
  mocks.useImportCurrentStoryGeneration.mockImplementation(() => importResult);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('StoryGenerationPage', () => {
  it('test_provider_option_given_account_is_not_linked_expect_locked_and_visible', async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();

    renderPage({}, onSearchChange);

    const lockedProvider = screen.getByRole('radio', { name: /ChatGPT/ });
    expect(lockedProvider).toHaveAttribute('aria-disabled', 'true');
    expect(
      screen.getByText(/Connect your ChatGPT account/),
    ).toBeInTheDocument();

    await user.click(lockedProvider);
    expect(onSearchChange).not.toHaveBeenCalled();
  });

  it('test_deck_anchor_given_below_minimum_expect_disabled_with_threshold', () => {
    renderPage();

    const deck = screen.getByRole('radio', { name: /My deck/ });
    expect(deck).toHaveAttribute('aria-disabled', 'true');
    expect(
      screen.getByText('Needs at least 100 words to unlock.'),
    ).toBeInTheDocument();
  });

  it('test_anchor_radiogroup_given_arrow_key_pressed_expect_next_available_anchor_selected', async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();

    renderPage({}, onSearchChange);

    await user.click(screen.getByRole('radio', { name: /Common words/ }));
    await user.keyboard('{ArrowDown}');

    expect(screen.getByRole('radio', { name: /Anything/ })).toHaveFocus();
    expect(onSearchChange).toHaveBeenLastCalledWith({ anchor: 'none' });
  });

  it('test_flyt_usage_given_surface_refresh_expect_single_updated_percentage', () => {
    const view = renderPage();

    expect(screen.getAllByText('77% left')).toHaveLength(1);
    expect(screen.queryByText(/Unlimited/)).not.toBeInTheDocument();
    expect(screen.queryByText(/used this week/)).not.toBeInTheDocument();

    surfaceResult = buildSurfaceQuery(buildSurface({ remainingPercent: 58 }));
    view.rerender(
      <LookupProvider>
        <StoryGenerationPage search={{}} onSearchChange={vi.fn()} />
      </LookupProvider>,
    );

    expect(screen.getAllByText('58% left')).toHaveLength(1);
  });

  it('test_topic_suggestions_given_suggestion_selected_expect_topic_remains_editable', async () => {
    const user = userEvent.setup();

    render(
      <LookupProvider>
        <StatefulPage />
      </LookupProvider>,
    );

    const topic = screen.getByRole('textbox', { name: 'Topic' });
    await user.click(screen.getByRole('button', { name: 'A rainy day' }));
    expect(topic).toHaveValue('A rainy day');
    expect(
      screen.getByRole('button', { name: 'A rainy day' }),
    ).toBeInTheDocument();

    await user.clear(topic);
    await user.type(topic, 'A forest path');
    expect(topic).toHaveValue('A forest path');
  });

  it('test_story_direction_group_given_form_rendered_expect_no_internal_anchor_term', () => {
    renderPage();

    expect(
      screen.getByRole('radiogroup', { name: 'Story direction' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/anchor/i)).not.toBeInTheDocument();
  });

  it('test_topic_given_prefilled_length_over_client_bound_expect_blocked_submit_and_focused_input', () => {
    currentResult = buildCurrentQuery(buildCurrent('ready'));
    const oversizedTopic = 'A very long topic '.repeat(13).trim().slice(0, 201);
    renderPage({ topic: oversizedTopic });

    const topic = screen.getByRole('textbox', { name: 'Topic' });
    const generate = screen.getByRole('button', { name: /^Generate$/ });
    generate.focus();

    fireEvent.click(generate);

    expect(createResult.mutate).not.toHaveBeenCalled();
    const status = screen.getByText(
      'Keep the topic to 200 characters or fewer.',
    );
    expect(status).toHaveTextContent(
      'Keep the topic to 200 characters or fewer.',
    );
    expect(topic).toHaveAttribute('aria-invalid', 'true');
    expect(topic).toHaveAttribute(
      'aria-describedby',
      expect.stringContaining('story-topic-error'),
    );
    expect(topic).toHaveFocus();
    expect(topic).toHaveAttribute('maxLength', '200');
    expect(screen.getByText('201/200 characters')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('test_topic_given_empty_input_expect_length_hint_and_client_cap', () => {
    renderPage();

    const topic = screen.getByRole('textbox', { name: 'Topic' });
    expect(topic).toHaveAttribute('maxLength', '200');
    expect(screen.getByText('0/200 characters')).toBeInTheDocument();
  });

  it('test_generation_status_given_refused_and_failed_outcomes_expect_distinct_surfaces', () => {
    currentResult = buildCurrentQuery(buildCurrent('refused'));
    const view = renderPage();

    expect(screen.getByTestId('generation-refused')).toBeInTheDocument();
    expect(
      screen.getByText('Flyt did not start this story'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('generation-failed')).not.toBeInTheDocument();

    currentResult = buildCurrentQuery(buildCurrent('failed'));
    view.rerender(
      <LookupProvider>
        <StoryGenerationPage search={{}} onSearchChange={vi.fn()} />
      </LookupProvider>,
    );

    expect(screen.getByTestId('generation-failed')).toBeInTheDocument();
    expect(
      screen.getByText('The story could not be finished'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('generation-refused')).not.toBeInTheDocument();
  });

  it('test_processing_state_given_backstop_not_reached_expect_plain_processing_heading', async () => {
    vi.useFakeTimers();
    currentResult = buildCurrentQuery(buildCurrent('processing'));

    renderPage();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        STORY_GENERATION_PROCESSING_STALL_BACKSTOP_MS - 1,
      );
    });

    expect(
      screen.getByRole('heading', { name: 'Writing your story' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {
        name: 'Your story is taking longer than usual',
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Try again' }),
    ).not.toBeInTheDocument();
  });

  it('test_processing_state_given_backstop_reached_expect_stalled_copy_and_retry', async () => {
    vi.useFakeTimers();
    currentResult = buildCurrentQuery(buildCurrent('processing'));

    renderPage();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        STORY_GENERATION_PROCESSING_STALL_BACKSTOP_MS,
      );
    });

    expect(
      screen.getByRole('heading', {
        name: 'Your story is taking longer than usual',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Try again' }),
    ).toBeInTheDocument();
  });

  it('test_generation_retry_given_stalled_copy_is_visible_expect_same_handler_as_failed_state', async () => {
    vi.useFakeTimers();
    const retryPayload = {
      provider: 'openrouter',
      anchor: 'frequency',
      length: 150,
      topic: undefined,
    };
    currentResult = buildCurrentQuery(buildCurrent('failed'));
    const view = renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(createResult.mutate).toHaveBeenCalledWith(retryPayload);

    currentResult = buildCurrentQuery(buildCurrent('processing'));
    view.rerender(
      <LookupProvider>
        <StoryGenerationPage search={{}} onSearchChange={vi.fn()} />
      </LookupProvider>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        STORY_GENERATION_PROCESSING_STALL_BACKSTOP_MS,
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(createResult.mutate).toHaveBeenNthCalledWith(2, retryPayload);
  });

  it('test_generation_retry_given_create_mutation_pending_expect_stalled_and_failed_actions_disabled', async () => {
    vi.useFakeTimers();
    createResult.isPending = true;
    currentResult = buildCurrentQuery(buildCurrent('processing'));
    const view = renderPage();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        STORY_GENERATION_PROCESSING_STALL_BACKSTOP_MS,
      );
    });

    expect(screen.getByRole('button', { name: 'Try again' })).toBeDisabled();

    currentResult = buildCurrentQuery(buildCurrent('failed'));
    view.rerender(
      <LookupProvider>
        <StoryGenerationPage search={{}} onSearchChange={vi.fn()} />
      </LookupProvider>,
    );

    expect(screen.getByRole('button', { name: 'Try again' })).toBeDisabled();
  });

  it('test_generated_story_given_ready_outcome_expect_word_lookup_and_import_action', async () => {
    const user = userEvent.setup();
    currentResult = buildCurrentQuery(buildCurrent('ready'));

    renderPage();

    expect(screen.getByRole('button', { name: 'Solen' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Import to library' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Solen' }));
  });

  it('test_generated_story_given_ready_outcome_expect_action_shelf_before_content', async () => {
    const user = userEvent.setup();
    currentResult = buildCurrentQuery(buildCurrent('ready'));

    renderPage();

    const shelf = screen.getByTestId('generated-story-actions');
    const article = screen.getByRole('article', { name: 'Generated story' });
    expect(shelf.compareDocumentPosition(article)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    for (const name of [
      'Read story',
      'Import to library',
      'Generate another',
    ]) {
      expect(within(shelf).getByRole('button', { name })).toBeInTheDocument();
    }
    expect(within(shelf).getByText('Not saved.')).toBeInTheDocument();
    expect(
      within(shelf).getByRole('button', { name: 'Generate another' }),
    ).toHaveAttribute('aria-describedby', 'generated-story-warning');

    await user.click(within(shelf).getByRole('button', { name: 'Read story' }));
    expect(article).toHaveFocus();

    await user.click(
      within(shelf).getByRole('button', { name: 'Generate another' }),
    );
    expect(createResult.mutate).toHaveBeenCalledWith({
      provider: 'openrouter',
      anchor: 'frequency',
      length: 150,
      topic: undefined,
    });
  });

  it('test_story_import_given_failure_expect_error_in_action_shelf', () => {
    currentResult = buildCurrentQuery(buildCurrent('ready'));
    importResult = {
      ...buildMutation(),
      error: new Error('The story could not be imported.'),
    };

    renderPage();

    const shelf = screen.getByTestId('generated-story-actions');
    expect(within(shelf).getByRole('alert')).toHaveTextContent(
      'The story could not be imported.',
    );
    expect(screen.getAllByText(/Generating again replaces/)).toHaveLength(1);
  });

  it('test_generated_story_given_pending_generation_expect_shelf_actions_disabled', () => {
    createResult.isPending = true;
    currentResult = buildCurrentQuery(buildCurrent('ready'));

    renderPage();

    const shelf = screen.getByTestId('generated-story-actions');
    expect(
      within(shelf).getByRole('button', { name: 'Generating…' }),
    ).toBeDisabled();
    expect(
      within(shelf).getByRole('button', { name: 'Read story' }),
    ).toBeEnabled();
  });

  it('test_generated_story_given_long_content_expect_bounded_desktop_and_sticky_mobile_shelf', () => {
    currentResult = buildCurrentQuery(buildCurrent('ready'));

    renderPage();

    const card = screen.getByTestId('generated-story');
    expect(card).toHaveClass('xl:max-h-[calc(100dvh-16rem)]');
    expect(card).toHaveClass('xl:overflow-hidden');

    const shelf = screen.getByTestId('generated-story-actions');
    expect(shelf).toHaveClass('sticky', 'top-0', 'bg-card');
    expect(shelf).toHaveClass('xl:static');
  });

  it('test_generated_story_given_partial_user_states_expect_known_word_not_new', () => {
    currentResult = buildCurrentQuery(
      buildCurrent('ready', { userStates: { 'lemma-solen': 'mastered' } }),
    );

    renderPage();

    const knownWord = screen.getByRole('button', { name: 'Solen' });
    const newWord = screen.getByRole('button', { name: 'skinner' });

    expect(knownWord).not.toHaveClass('word-underline-new');
    expect(newWord).toHaveClass('word-underline-new');
  });

  it('test_direct_provider_given_linked_chatgpt_expect_no_usage_field', () => {
    const directSurface = buildSurface();
    directSurface.providers[1] = buildProvider('chatgpt', {
      available: true,
      limitedByFlyt: false,
      reason: null,
      action: null,
      remainingPercent: null,
    });
    surfaceResult = buildSurfaceQuery(directSurface);

    renderPage();

    expect(
      screen.getAllByRole('radio', { name: /ChatGPT/ }).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/% left/)).toHaveLength(1);
    expect(
      screen.queryByText('Flyt does not limit your linked account.'),
    ).not.toBeInTheDocument();
  });

  it('test_exhausted_flyt_usage_given_hundred_percent_expect_percentage_only', () => {
    const exhaustedSurface = buildSurface({ remainingPercent: 0 });
    surfaceResult = buildSurfaceQuery(exhaustedSurface);

    renderPage();

    expect(screen.getAllByText('0% left')).toHaveLength(1);
    expect(
      screen.queryByText(/The next story is available in/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/rolling allowance window/),
    ).not.toBeInTheDocument();
  });

  it('test_surface_response_given_loaded_expect_min_deck_size_carried_through', () => {
    const surface = buildSurface();
    surface.minDeckSize = 42;
    surfaceResult = buildSurfaceQuery(surface);

    renderPage();

    expect(
      screen.getByText('Needs at least 42 words to unlock.'),
    ).toBeInTheDocument();
  });
});
