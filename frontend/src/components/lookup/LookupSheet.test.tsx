import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import * as lexiconApi from '@/api/lexicon';
import {
  useBrowseHeadword,
  useLemmaDefinitions,
} from '@/hooks/lexicon/queries';

import { LookupProvider } from './LookupProvider';
import { LookupSheet } from './LookupSheet';
import { useLookupContext } from './useLookupContext';

interface RouterState {
  location: { pathname: string };
}

// Mutable router + desktop state so individual tests can pin the route and
// viewport without re-mocking the modules.
const routerState = vi.hoisted(() => ({ pathname: '/home' }));
const desktopState = vi.hoisted(() => ({ value: false }));

vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({ select }: { select: (s: RouterState) => unknown }) =>
    select({ location: { pathname: routerState.pathname } }),
  // Simulate the reader-leaf match: truthy only on a story URL, mirroring the
  // real router's behaviour for `useMatch({ from: '/_reader/reading/story/$uuid' })`.
  useMatch: ({ shouldThrow }: { shouldThrow?: boolean }) => {
    const matched = routerState.pathname.startsWith('/reading/story/');
    if (!matched && shouldThrow) throw new Error('no match');
    return matched ? { id: '/_reader/reading/story/$uuid' } : false;
  },
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

    let emptyState: HTMLElement | null = null;
    await waitFor(() => {
      emptyState = screen.getByText('No matches');
      expect(emptyState).toBeInTheDocument();
    });
    expect(emptyState).toHaveClass('min-h-[7.5rem]');
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

  it('shows error for invalid characters', async () => {
    renderSearchSheet();
    await userEvent.click(screen.getByText('open search'));
    const input = screen.getByPlaceholderText('Search a Norwegian word');

    await userEvent.type(input, 'hello123');

    await waitFor(() => {
      expect(
        screen.getByText(
          'Please use letters only. Norwegian letters like ae, oe, and aa are supported.',
        ),
      ).toBeInTheDocument();
    });
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

function OpenBrowseButton() {
  const ctx = useLookupContext();
  return (
    <button
      onClick={() => {
        ctx.openSearch();
        // Browse fallback: open a homograph by headword with no known uuid.
        ctx.switchToLemma(null, 'hus');
      }}
    >
      open browse
    </button>
  );
}

function renderBrowseSheet() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <LookupProvider>
        <OpenBrowseButton />
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
});

// ── Desktop lemma rendering ─────────────────────────────────────────────────
// Regression: previously LookupSheet suppressed the modal for *all* desktop
// lemma mode. That left no surface on app/session shells (which have no side
// panel), so clicking a search result on /home desktop opened nothing. The
// sheet must render lemma content on desktop unless the reader side panel is
// the one handling it.

describe('LookupSheet — desktop lemma routing', () => {
  beforeEach(() => {
    routerState.pathname = '/home';
    desktopState.value = true;
  });
  afterEach(() => {
    routerState.pathname = '/home';
    desktopState.value = false;
  });

  it('renders lemma modal on desktop outside the reader route', async () => {
    routerState.pathname = '/home';
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

  // Regression: lemma results used to render in a bottom sheet on desktop,
  // visually disconnecting them from the navbar search entry (search at top,
  // result sliding up from the bottom). Desktop search AND lemma now share one
  // top-anchored popover so the back affordance returns to the typing surface.
  it('renders desktop lemma in the top-anchored popover, not the bottom sheet', async () => {
    routerState.pathname = '/home';
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
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('top-20');
    expect(dialog).not.toHaveClass('bottom-4');
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
    routerState.pathname = '/home';
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
    routerState.pathname = '/home';
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
    routerState.pathname = '/home';
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

  it('suppresses lemma modal on the desktop reader route (side panel handles it)', async () => {
    routerState.pathname = '/reading/story/abc';
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
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
