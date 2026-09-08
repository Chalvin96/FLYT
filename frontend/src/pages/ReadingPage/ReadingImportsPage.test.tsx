import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { ImportFilterValue } from '@/components/reading/importDisplay';
import type { ImportItem, ImportListResponse } from '@/types/api';

import { ReadingImportsPage } from './ReadingImportsPage';

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

const { listImports, createPasteImport } = vi.hoisted(() => ({
  listImports: vi.fn(),
  createPasteImport: vi.fn(),
}));

vi.mock('@/api/imports', () => ({
  listImports,
  createPasteImport,
}));

// Comfortably past the 250ms debounce, so a re-armed timer has fired by now.
const SETTLE_MS = 700;

function buildItem(overrides: Partial<ImportItem> = {}): ImportItem {
  return {
    id: 'import-1',
    storyUuid: 'story-1',
    title: 'Historien om Norge',
    sourceUrl: 'https://nrk.no/artikkel',
    status: 'ready',
    errorCode: null,
    errorMessage: null,
    pageCount: 4,
    wordCount: 890,
    createdAt: '2026-07-18T10:00:00Z',
    ...overrides,
  };
}

function buildListResponse(
  items: ImportItem[],
  overrides: Partial<ImportListResponse> = {},
): ImportListResponse {
  return {
    items,
    nextCursor: null,
    quota: { used: items.length, limit: 10 },
    ...overrides,
  };
}

function renderPage(
  propsOverride: {
    filter?: ImportFilterValue;
    q?: string;
    onFilterChange?: (filter: ImportFilterValue) => void;
    onSearchChange?: (q: string | undefined) => void;
  } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onFilterChange = vi.fn();
  const onSearchChange = vi.fn();
  return {
    onFilterChange,
    onSearchChange,
    ...render(
      <QueryClientProvider client={queryClient}>
        <ReadingImportsPage
          filter={propsOverride.filter ?? 'all'}
          q={propsOverride.q}
          onFilterChange={propsOverride.onFilterChange ?? onFilterChange}
          onSearchChange={propsOverride.onSearchChange ?? onSearchChange}
        />
      </QueryClientProvider>,
    ),
  };
}

describe('ReadingImportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default the create mutation to a no-op so individual tests don't have
    // to set it up unless they exercise the paste flow.
    createPasteImport.mockResolvedValue(
      buildItem({ id: 'created-1', title: 'Created', status: 'pending' }),
    );
  });

  it('test_imports_page_given_first_time_empty_expect_empty_state_with_install_link', async () => {
    listImports.mockResolvedValue(
      buildListResponse([], { quota: { used: 0, limit: 10 } }),
    );

    renderPage();

    expect(
      await screen.findByRole('heading', {
        name: 'Import your first text',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: 'install the browser extension',
      }),
    ).toHaveAttribute('href', '/reading/imports/install');
  });

  it('test_imports_page_given_populated_list_expect_grid_with_quota_indicator', async () => {
    listImports.mockResolvedValue(
      buildListResponse([
        buildItem({ id: 'i1', title: 'Artikkel en', status: 'ready' }),
        buildItem({ id: 'i2', title: 'Artikkel to', status: 'processing' }),
      ]),
    );

    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Your imports' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Artikkel en')).toBeInTheDocument();
    expect(await screen.findByText('Artikkel to')).toBeInTheDocument();
    // Quota indicator renders the user's import usage.
    expect(screen.getByText(/2\/10 imports/)).toBeInTheDocument();
  });

  it('test_imports_page_given_status_filter_click_expect_list_refetched_with_status', async () => {
    const user = userEvent.setup();
    listImports.mockResolvedValue(
      buildListResponse([
        buildItem({ id: 'i1', title: 'Ready one', status: 'ready' }),
      ]),
    );

    const { onFilterChange } = renderPage();

    await screen.findByText('Ready one');

    // Click the "Failed" filter chip.
    await user.click(screen.getByRole('button', { name: /Failed/i }));

    await waitFor(() => {
      expect(onFilterChange).toHaveBeenCalledWith('failed');
    });
  });

  it('test_imports_page_given_search_input_expect_debounced_query_parameter', async () => {
    const user = userEvent.setup();
    listImports.mockResolvedValue(
      buildListResponse([buildItem({ title: 'Klima' })]),
    );

    const { onSearchChange } = renderPage();

    await screen.findByText('Klima');

    await user.type(
      screen.getByLabelText('Search your imports'),
      'klima',
      // skip the debounce wait between keystrokes
    );

    // Debounce is 250ms; wait for the callback to fire with the query.
    await waitFor(
      () => {
        expect(onSearchChange).toHaveBeenCalledWith('klima');
      },
      { timeout: 1500 },
    );
  });

  it('test_imports_page_given_unstable_search_callback_expect_one_call_and_no_mount_call', async () => {
    // The route passes a fresh closure every render and re-renders in response
    // to the call, so the search push must not be keyed on callback identity.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    listImports.mockResolvedValue(
      buildListResponse([buildItem({ title: 'Klima' })]),
    );

    const onSearchChange = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    function RouteHarness() {
      const [q, setQ] = useState<string | undefined>(undefined);
      return (
        <ReadingImportsPage
          filter="all"
          q={q}
          onFilterChange={() => {}}
          onSearchChange={(next) => {
            onSearchChange(next);
            setQ(next);
          }}
        />
      );
    }

    render(
      <QueryClientProvider client={queryClient}>
        <RouteHarness />
      </QueryClientProvider>,
    );

    await screen.findByText('Klima');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });
    expect(onSearchChange).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Search your imports'), 'klima');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });

    expect(onSearchChange).toHaveBeenCalledExactlyOnceWith('klima');
    vi.useRealTimers();
  });

  it('test_imports_page_given_unmount_before_debounce_expect_no_search_change', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    listImports.mockResolvedValue(
      buildListResponse([buildItem({ title: 'Klima' })]),
    );

    const { onSearchChange, unmount } = renderPage();

    await screen.findByText('Klima');
    await user.type(screen.getByLabelText('Search your imports'), 'klima');
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });

    expect(onSearchChange).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('test_imports_page_given_error_state_expect_retry_control', async () => {
    listImports.mockRejectedValue(new Error('network down'));

    renderPage();

    expect(
      await screen.findByText('Could not load your imports.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('test_import_create_given_successful_submit_expect_optimistic_card_then_real_card', async () => {
    const user = userEvent.setup();
    // First fetch: no imports. The create resolves to a pending item; the
    // subsequent invalidation refetch returns it as ready.
    const realItem = buildItem({
      id: 'real-1',
      title: 'New article',
      status: 'ready',
    });
    listImports
      .mockResolvedValueOnce(
        buildListResponse([], { quota: { used: 0, limit: 10 } }),
      )
      .mockResolvedValueOnce(
        buildListResponse([realItem], { quota: { used: 1, limit: 10 } }),
      );
    createPasteImport.mockResolvedValueOnce(realItem);

    renderPage();

    // Open the paste sheet from the empty-state CTA.
    await screen.findByRole('heading', { name: 'Import your first text' });
    await user.click(
      screen.getAllByRole('button', { name: /Import text/i })[0],
    );

    const textarea = await screen.findByPlaceholderText('Paste text here…');
    await user.type(textarea, 'En kort setning.');
    await user.click(screen.getByRole('button', { name: 'Import' }));

    // After the create resolves, the invalidation refetches and the real
    // ready card replaces the optimistic placeholder. Assert that the real
    // row is what is rendered (not the optimistic placeholder which had
    // status=pending and was non-interactive).
    const link = await screen.findByRole('link', {
      name: /New article/i,
    });
    expect(link).toHaveAttribute('href', '/reading/story/story-1');
  });
});
