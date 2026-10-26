import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';

import * as lexiconApi from '@/api/lexicon';
import {
  useBrowseHeadword,
  useLemmaDefinitions,
} from '@/hooks/lexicon/queries';

import { LookupProvider } from './LookupProvider';
import { LookupSheet } from './LookupSheet';
import { useLookupContext } from './useLookupContext';

const desktopState = vi.hoisted(() => ({ value: false }));

vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({
    select,
  }: {
    select: (state: {
      location: { pathname: string; search: Record<string, unknown> };
    }) => unknown;
  }) => select({ location: { pathname: '/home', search: {} } }),
}));

vi.mock('@/hooks/ui/useIsDesktop', () => ({
  useIsDesktop: () => desktopState.value,
}));

vi.mock('@/hooks/lexicon/queries', async () => {
  const actual = await vi.importActual<
    typeof import('@/hooks/lexicon/queries')
  >('@/hooks/lexicon/queries');
  return {
    ...actual,
    useLemmaDefinitions: vi.fn(() => ({
      data: {
        definitions: [
          {
            uuid: 'd1',
            userState: 'new' as const,
            definition: 'a dwelling',
            examples: [],
            translation: 'house',
            translation_source: 'test',
          },
        ],
        lemma: {
          word: 'hus',
          pos: 'noun',
          uuid: 'lemma-1',
          primary_translation: 'house',
        },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })),
    useBrowseHeadword: vi.fn(() => ({
      data: {
        headword: 'test',
        entries: [],
        selected_lemma_uuid: null,
        is_fallback: false,
      },
      isFetched: false,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })),
  };
});

function OpenLemmaButton() {
  const ctx = useLookupContext();
  return <button onClick={() => ctx.openLemma('lemma-1', 'hus')}>open</button>;
}

function renderSheet() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <LookupProvider>
        <OpenLemmaButton />
        <LookupSheet />
      </LookupProvider>
    </QueryClientProvider>,
  );
}

describe('LookupSheet — lemma mode', () => {
  it('is not in DOM when closed', () => {
    renderSheet();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows word title immediately on open before data loads', async () => {
    renderSheet();
    await userEvent.click(screen.getByText('open'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'hus', level: 2 }),
    ).toBeInTheDocument();
  });

  it('renders definition content once data is present', async () => {
    renderSheet();
    await userEvent.click(screen.getByText('open'));
    // LemmaCard renders button for action (I already know this / Add to review)
    expect(
      await screen.findByRole('button', {
        name: /I already know this/i,
      }),
    ).toBeInTheDocument();
  });

  it('Escape closes the sheet', async () => {
    renderSheet();
    await userEvent.click(screen.getByText('open'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  // Back button is always visible in lemma mode
  it('shows back to search button in lemma mode even without priorQuery', async () => {
    renderSheet();
    await userEvent.click(screen.getByText('open'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const backBtn = screen.getByRole('button', { name: /back to search/i });
    expect(backBtn).toBeInTheDocument();
  });

  it('includes dialog description text in lemma mode', async () => {
    renderSheet();
    await userEvent.click(screen.getByText('open'));
    expect(screen.getByText('Dictionary entry for hus')).toBeInTheDocument();
  });
});

function OpenSearchButton() {
  const ctx = useLookupContext();
  return <button onClick={() => ctx.openSearch()}>open search</button>;
}

function renderSearchSheet() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <LookupProvider>
        <OpenSearchButton />
        <LookupSheet />
      </LookupProvider>
    </QueryClientProvider>,
  );
}

describe('LookupSheet — search mode', () => {
  it('input is focused on open', async () => {
    renderSearchSheet();
    await userEvent.click(screen.getByText('open search'));
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('Search a Norwegian word'),
      ).toHaveFocus();
    });
  });

  it('includes dialog description text in search mode', async () => {
    renderSearchSheet();
    await userEvent.click(screen.getByText('open search'));
    expect(
      screen.getByText('Search the Norwegian dictionary'),
    ).toBeInTheDocument();
  });

  it('shows empty helper text when no query', async () => {
    renderSearchSheet();
    await userEvent.click(screen.getByText('open search'));
    expect(
      screen.getByText('Type at least 2 characters to search'),
    ).toBeInTheDocument();
  });

  it('shows skeleton loading rows when pending', async () => {
    vi.spyOn(lexiconApi, 'getSuggestions').mockImplementation(
      () =>
        new Promise(() => {
          // never resolve
        }),
    );

    renderSearchSheet();
    await userEvent.click(screen.getByText('open search'));
    const input = screen.getByPlaceholderText('Search a Norwegian word');

    await userEvent.type(input, 'te');

    await waitFor(() => {
      const skeletons = screen.getAllByRole('presentation');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  it('shows "No matches" when suggestions empty', async () => {
    vi.spyOn(lexiconApi, 'getSuggestions').mockResolvedValue({
      suggestions: [],
    });

    renderSearchSheet();
    await userEvent.click(screen.getByText('open search'));
    const input = screen.getByPlaceholderText('Search a Norwegian word');

    await userEvent.type(input, 'zzzz');

    await waitFor(() => {
      expect(screen.getByText('No matches')).toBeInTheDocument();
    });
  });

  it('clicking a suggestion is clickable', async () => {
    vi.spyOn(lexiconApi, 'getSuggestions').mockResolvedValue({
      suggestions: [{ label: 'test' }],
    });

    renderSearchSheet();
    await userEvent.click(screen.getByText('open search'));
    const input = screen.getByPlaceholderText('Search a Norwegian word');

    await userEvent.type(input, 'te');

    const suggestion = await screen.findByRole('option');
    expect(suggestion).toBeInTheDocument();
  });

  it('Escape closes the open suggestion dropdown first, then the sheet', async () => {
    vi.spyOn(lexiconApi, 'getSuggestions').mockResolvedValue({
      suggestions: [{ label: 'test' }],
    });

    renderSearchSheet();
    await userEvent.click(screen.getByText('open search'));
    const input = screen.getByPlaceholderText('Search a Norwegian word');

    await userEvent.type(input, 'te');
    await screen.findByRole('listbox', { name: /suggestions/i });

    // First Escape: dropdown closes, sheet stays open.
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(
        screen.queryByRole('listbox', { name: /suggestions/i }),
      ).toBeNull();
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Second Escape: sheet closes.
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('× button clears search', async () => {
    renderSearchSheet();
    await userEvent.click(screen.getByText('open search'));
    const input = screen.getByPlaceholderText('Search a Norwegian word');

    await userEvent.type(input, 'test');
    expect(input).toHaveValue('test');

    const clearBtn = screen.getByRole('button', { name: 'Clear search' });
    await userEvent.click(clearBtn);

    expect(input).toHaveValue('');
  });

  it('arrow keys navigate suggestions', async () => {
    vi.spyOn(lexiconApi, 'getSuggestions').mockResolvedValue({
      suggestions: [{ label: 'test1' }, { label: 'test2' }, { label: 'test3' }],
    });

    // Mock scrollIntoView for test environment
    Element.prototype.scrollIntoView = vi.fn();

    renderSearchSheet();
    await userEvent.click(screen.getByText('open search'));
    const input = screen.getByPlaceholderText('Search a Norwegian word');

    await userEvent.type(input, 'te');

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /test1/ })).toBeInTheDocument();
    });

    // ArrowDown should highlight second item
    await userEvent.keyboard('{ArrowDown}');
    const option2 = screen.getByRole('option', { name: /test2/ });
    expect(option2).toHaveAttribute('aria-selected', 'true');
  });

  it('test_suggestions_given_highlight_expect_selected_row_state', async () => {
    vi.spyOn(lexiconApi, 'getSuggestions').mockResolvedValue({
      suggestions: [{ label: 'test1' }, { label: 'test2' }],
    });

    renderSearchSheet();
    await userEvent.click(screen.getByText('open search'));
    await userEvent.type(
      screen.getByPlaceholderText('Search a Norwegian word'),
      'te',
    );

    const first = await screen.findByRole('option', { name: 'test1' });
    const second = screen.getByRole('option', { name: 'test2' });
    expect(first).toHaveAttribute('data-state', 'selected');
    expect(second).toHaveAttribute('data-state', 'idle');

    await userEvent.keyboard('{ArrowDown}');

    expect(second).toHaveAttribute('data-state', 'selected');
    expect(first).toHaveAttribute('data-state', 'idle');
  });

  it('test_suggestions_given_expression_expect_alternatives_beneath_primary', async () => {
    vi.spyOn(lexiconApi, 'getSuggestions').mockResolvedValue({
      suggestions: [
        {
          label: 'få i stand',
          alternative_forms: ['stelle i stand', 'lage i stand'],
        },
      ],
    });

    renderSearchSheet();
    await userEvent.click(screen.getByText('open search'));
    await userEvent.type(
      screen.getByPlaceholderText('Search a Norwegian word'),
      'få',
    );

    expect(
      await screen.findByText('stelle i stand · lage i stand'),
    ).toBeVisible();
    const option = screen.getByRole('option', { name: 'få i stand' });
    expect(option).toBeVisible();

    await userEvent.click(option);

    expect(screen.getByRole('button', { name: '← "få"' })).toBeVisible();
  });

  it('test_suggestions_given_canonical_bracket_label_expect_presented_alternatives_with_canonical_accessible_name_and_selection', async () => {
    const canonical = 'få [stelle|lage] i stand';
    vi.spyOn(lexiconApi, 'getSuggestions').mockResolvedValue({
      suggestions: [{ label: canonical }],
    });

    renderSearchSheet();
    await userEvent.click(screen.getByText('open search'));
    await userEvent.type(
      screen.getByPlaceholderText('Search a Norwegian word'),
      'få',
    );

    const option = await screen.findByRole('option', { name: canonical });
    expect(option).toHaveTextContent('få [stelle / lage] i stand');
    expect(option).not.toHaveTextContent(canonical);

    await userEvent.click(option);

    expect(screen.getByTestId('lemma-content')).toHaveAttribute(
      'aria-label',
      `Dictionary entry for ${canonical}`,
    );
  });

  it('test_lookup_sheet_given_prior_query_crumb_expect_back_returns_to_search', async () => {
    vi.spyOn(lexiconApi, 'getSuggestions').mockResolvedValue({
      suggestions: [{ label: 'test' }],
    });

    renderSearchSheet();
    await userEvent.click(screen.getByText('open search'));
    await userEvent.type(
      screen.getByPlaceholderText('Search a Norwegian word'),
      'te',
    );
    await userEvent.click(await screen.findByRole('option', { name: 'test' }));

    const crumb = await screen.findByRole('button', { name: '← "te"' });
    await userEvent.click(crumb);

    expect(
      screen.getByPlaceholderText('Search a Norwegian word'),
    ).toBeInTheDocument();
  });

  it('Enter commits selection on highlighted suggestion', async () => {
    vi.spyOn(lexiconApi, 'getSuggestions').mockResolvedValue({
      suggestions: [{ label: 'test' }],
    });

    renderSearchSheet();
    await userEvent.click(screen.getByText('open search'));
    const input = screen.getByPlaceholderText('Search a Norwegian word');

    await userEvent.type(input, 'te');

    await screen.findByRole('option');

    await userEvent.keyboard('{Enter}');

    // After Enter commits selection, should switch to lemma mode
    // Input should no longer be visible and lemma content should appear
    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText('Search a Norwegian word'),
      ).not.toBeInTheDocument();
    });
    // Lemma title should now be visible
    expect(screen.getByText('test')).toBeInTheDocument();
  });

  it('test_lookup_input_given_invalid_characters_expect_associated_alert', async () => {
    renderSearchSheet();
    await userEvent.click(screen.getByText('open search'));
    const input = screen.getByPlaceholderText('Search a Norwegian word');

    await userEvent.type(input, 'hello%');

    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent(
      'Use letters, numbers, spaces, and dictionary punctuation (maximum 80 characters).',
    );
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', error.id);
  });

  it('has proper ARIA attributes', async () => {
    renderSearchSheet();
    await userEvent.click(screen.getByText('open search'));
    const input = screen.getByPlaceholderText('Search a Norwegian word');

    expect(input).toHaveAttribute('role', 'combobox');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
  });

  // Fix 5: Drop role="listbox" from empty/loading wrappers
  it('uses role="status" for loading skeletons, not role="listbox"', async () => {
    vi.spyOn(lexiconApi, 'getSuggestions').mockImplementation(
      () =>
        new Promise(() => {
          // never resolve
        }),
    );

    renderSearchSheet();
    await userEvent.click(screen.getByText('open search'));
    const input = screen.getByPlaceholderText('Search a Norwegian word');

    await userEvent.type(input, 'te');

    await waitFor(() => {
      const statusDiv = screen.getByRole('status', {
        name: /loading suggestions/i,
      });
      expect(statusDiv).toBeInTheDocument();
      // Verify listbox role is NOT on the loading wrapper
      expect(statusDiv).not.toHaveAttribute('role', 'listbox');
    });
  });

  it('uses role="status" for empty suggestions, not role="listbox"', async () => {
    vi.spyOn(lexiconApi, 'getSuggestions').mockResolvedValue({
      suggestions: [],
    });

    renderSearchSheet();
    await userEvent.click(screen.getByText('open search'));
    const input = screen.getByPlaceholderText('Search a Norwegian word');

    await userEvent.type(input, 'zzzz');

    await waitFor(() => {
      const statusDiv = screen.getByRole('status');
      expect(statusDiv).toBeInTheDocument();
      // Verify listbox role is NOT on the empty state wrapper
      expect(statusDiv).not.toHaveAttribute('role', 'listbox');
    });
  });

  it('uses role="listbox" only for actual suggestions list', async () => {
    vi.spyOn(lexiconApi, 'getSuggestions').mockResolvedValue({
      suggestions: [{ label: 'test1' }, { label: 'test2' }],
    });

    renderSearchSheet();
    await userEvent.click(screen.getByText('open search'));
    const input = screen.getByPlaceholderText('Search a Norwegian word');

    await userEvent.type(input, 'te');

    await waitFor(() => {
      const listbox = screen.getByRole('listbox', { name: /suggestions/i });
      expect(listbox).toBeInTheDocument();
    });
  });
});

function OpenBrowseButton({ wordText = 'hus' }: { wordText?: string }) {
  const ctx = useLookupContext();
  return (
    <button
      onClick={() => {
        ctx.openSearch();
        // Browse fallback: open a homograph by headword with no known uuid.
        ctx.switchToLemma(null, wordText);
      }}
    >
      open browse
    </button>
  );
}

function renderBrowseSheet(wordText = 'hus') {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <LookupProvider>
        <OpenBrowseButton wordText={wordText} />
        <LookupSheet />
      </LookupProvider>
    </QueryClientProvider>,
  );
}

describe('LookupSheet — browse mode', () => {
  it('shows a retry when a homograph definition fails to load', async () => {
    vi.mocked(useBrowseHeadword).mockReturnValue({
      data: {
        headword: 'hus',
        entries: [{ uuid: 'browse-uuid-1', hgno: 1, label: 'hus' }],
        selected_lemma_uuid: null,
        is_fallback: true,
      },
      isFetched: true,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useBrowseHeadword>);

    const refetch = vi.fn();
    vi.mocked(useLemmaDefinitions).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    } as unknown as ReturnType<typeof useLemmaDefinitions>);

    renderBrowseSheet();
    await userEvent.click(screen.getByText('open browse'));

    // Definition load failed, so the card must surface a retry rather than
    // rendering nothing.
    expect(
      await screen.findByText('Definition unavailable.'),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('test_lookup_sheet_given_missing_headword_expect_no_definition_within_default_timeout', async () => {
    const { useBrowseHeadword: useRealBrowseHeadword } = await vi.importActual<
      typeof import('@/hooks/lexicon/queries')
    >('@/hooks/lexicon/queries');
    const browseRequest = vi
      .spyOn(lexiconApi, 'browseHeadword')
      .mockRejectedValue(
        new AxiosError('Not Found', 'ERR_BAD_REQUEST', undefined, undefined, {
          data: null,
          status: 404,
          statusText: 'Not Found',
          headers: new AxiosHeaders(),
          config: { headers: new AxiosHeaders() },
        }),
      );

    await vi
      .mocked(useBrowseHeadword)
      .withImplementation(useRealBrowseHeadword, async () => {
        renderBrowseSheet('notaword');
        await userEvent.click(screen.getByText('open browse'));
        expect(
          await screen.findByText('No definition found for this word.'),
        ).toBeInTheDocument();
        expect(browseRequest).toHaveBeenCalledExactlyOnceWith('notaword');
      });
  });
});

// ── Desktop lemma rendering ─────────────────────────────────────────────────
// Regression: previously LookupSheet suppressed the modal for *all* desktop
// lemma mode. That left no surface on app/session shells (which have no side
// panel), so clicking a search result on /home desktop opened nothing. The
// sheet must render lemma content on desktop unless the reader side panel is
// the one handling it.

describe('LookupSheet — desktop lemma routing', () => {
  beforeEach(() => {
    desktopState.value = true;
  });
  afterEach(() => {
    desktopState.value = false;
  });

  it('renders lemma modal on desktop outside the reader route', async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <LookupProvider>
          <OpenLemmaButton />
          <LookupSheet />
        </LookupProvider>
      </QueryClientProvider>,
    );

    await userEvent.click(screen.getByText('open'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'hus', level: 2 }),
    ).toBeInTheDocument();
  });

  // Focus moves into the lemma container ONLY on a search→lemma swap (when
  // priorQuery is set): the combobox unmounts inside the same open dialog, so
  // focus needs an explicit target. A direct open (priorQuery null) leaves
  // focus to Radix's dialog handling — including on mobile.
  function SwapToLemmaButton() {
    const ctx = useLookupContext();
    return (
      <button
        onClick={() => {
          ctx.openSearch('h');
          ctx.switchToLemma('lemma-1', 'hus');
        }}
      >
        swap to lemma
      </button>
    );
  }

  it('moves focus to the lemma container after a search→lemma swap', async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <LookupProvider>
          <SwapToLemmaButton />
          <LookupSheet />
        </LookupProvider>
      </QueryClientProvider>,
    );

    await userEvent.click(screen.getByText('swap to lemma'));
    const lemmaContainer = await screen.findByTestId('lemma-content');
    await waitFor(() => {
      expect(lemmaContainer).toHaveFocus();
    });
  });

  it('does not steal focus on a direct lemma open (leaves it to Radix)', async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <LookupProvider>
          <OpenLemmaButton />
          <LookupSheet />
        </LookupProvider>
      </QueryClientProvider>,
    );

    await userEvent.click(screen.getByText('open'));
    await screen.findByTestId('lemma-content');
    // Container is focusable but should not have been programmatically focused
    // on a fresh open (priorQuery null).
    expect(screen.getByTestId('lemma-content')).not.toHaveFocus();
  });

  it('Escape closes the lemma popover on desktop', async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <LookupProvider>
          <OpenLemmaButton />
          <LookupSheet />
        </LookupProvider>
      </QueryClientProvider>,
    );

    await userEvent.click(screen.getByText('open'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('test_lookup_sheet_given_reader_owned_lemma_expect_no_duplicate_dialog', async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <LookupProvider>
          <OpenLemmaButton />
          <LookupSheet readerOwnsLemma />
        </LookupProvider>
      </QueryClientProvider>,
    );

    await userEvent.click(screen.getByText('open'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
