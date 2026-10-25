import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { ImportFilterValue } from '@/components/reading/importDisplay';
import type { ImportItem } from '@/types/api';

import { ReadingImportsPage } from './ReadingImportsPage';

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
  }) => (
    <a href={params ? to.replace('$uuid', params.uuid) : to} {...props}>
      {children}
    </a>
  ),
}));
const { listImports, createPasteImport, retryImport, deleteImport } =
  vi.hoisted(() => ({
    listImports: vi.fn(),
    createPasteImport: vi.fn(),
    retryImport: vi.fn(),
    deleteImport: vi.fn(),
  }));
vi.mock('@/api/imports', () => ({
  listImports,
  createPasteImport,
  retryImport,
  deleteImport,
}));

function item(
  index: number,
  status: ImportItem['status'] = 'ready',
): ImportItem {
  return {
    id: `import-${index}`,
    storyUuid: `story-${index}`,
    title: `En norsk artikkel ${index}`,
    sourceUrl: 'https://nrk.no/artikkel',
    status,
    errorCode:
      status === 'failed'
        ? 'IMPORT_TEXT_COULD_NOT_BE_SPLIT_INTO_PAGES_WITH_VALID_TOKENS'
        : null,
    errorMessage:
      status === 'failed' ? 'We could not split this text into pages.' : null,
    pageCount: status === 'ready' ? 4 : null,
    wordCount: 890,
    createdAt: '2026-10-07T10:00:00',
  };
}

function renderPage(items: ImportItem[], used = items.length) {
  listImports.mockResolvedValue({
    items,
    nextCursor: null,
    quota: { used, limit: 200 },
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Harness() {
    const [filter, setFilter] = useState<ImportFilterValue>('all');
    const [q, setQ] = useState<string | undefined>();
    return (
      <ReadingImportsPage
        filter={filter}
        q={q}
        onFilterChange={setFilter}
        onSearchChange={setQ}
        onClearFilters={() => {
          setQ(undefined);
          setFilter('all');
        }}
      />
    );
  }
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness />
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('ReadingImportsPage', () => {
  it('test_imports_given_empty_list_expect_one_import_button_and_extension_link', async () => {
    renderPage([]);
    expect(
      await screen.findByRole('heading', {
        name: 'Bring your own Norwegian text',
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Import/ })).toHaveLength(1);
    expect(
      screen.getByRole('link', { name: 'browser extension' }),
    ).toHaveAttribute('href', '/reading/imports/install');
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('test_imports_given_one_processing_text_expect_processing_only_without_filters', async () => {
    renderPage([item(1, 'processing')]);
    expect(
      await screen.findByRole('heading', { name: 'Processing' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Ready' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Needs attention' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.getByText('1 of 200 import slots used')).toBeInTheDocument();
  });

  it('test_imports_given_mixed_states_expect_failed_then_processing_then_ready', async () => {
    renderPage([item(1), item(2, 'processing'), item(3, 'failed')]);
    const failed = await screen.findByRole('region', {
      name: 'Needs attention',
    });
    const processing = screen.getByRole('region', { name: 'Processing' });
    const ready = screen.getByRole('region', { name: 'Ready' });
    expect(failed.compareDocumentPosition(processing)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(processing.compareDocumentPosition(ready)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(
      within(failed).getByRole('button', { name: 'Retry' }),
    ).toBeInTheDocument();
    expect(
      within(failed).getByRole('button', { name: 'Delete' }),
    ).toBeInTheDocument();
    expect(
      within(failed).getByText(
        'IMPORT_TEXT_COULD_NOT_BE_SPLIT_INTO_PAGES_WITH_VALID_TOKENS',
      ),
    ).toBeInTheDocument();
    expect(
      within(ready).getByRole('link', { name: /En norsk artikkel 1/ }),
    ).toHaveAttribute('href', '/reading/story/story-1');
  });

  it('test_imports_given_quota_full_expect_disabled_import_and_counted_statuses', async () => {
    renderPage(
      Array.from({ length: 200 }, (_, index) =>
        item(index, index < 3 ? 'failed' : index < 5 ? 'processing' : 'ready'),
      ),
    );
    expect(
      await screen.findByRole('button', { name: 'All 200' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Failed 3' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Processing 2' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Ready 195' }),
    ).toBeInTheDocument();
    const importButton = screen.getByRole('button', {
      name: 'Import',
    });
    expect(importButton).toBeDisabled();
    expect(importButton).toHaveAccessibleDescription(
      'You have 200 imports. Delete one to free a slot.',
    );
    expect(
      within(screen.getByRole('region', { name: 'Ready' })).getAllByRole(
        'link',
      ),
    ).toHaveLength(30);
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Show 30 more' }));
    expect(
      within(screen.getByRole('region', { name: 'Ready' })).getAllByRole(
        'link',
      ),
    ).toHaveLength(60);
  });

  it('test_imports_given_all_imports_deleted_expect_empty_import_enabled', async () => {
    renderPage([], 0);
    expect(
      await screen.findByRole('button', { name: 'Import text' }),
    ).toBeEnabled();
    expect(screen.getByText('0 of 200 import slots used')).toBeInTheDocument();
  });

  it('test_imports_given_search_and_status_filters_expect_local_matches_and_clear', async () => {
    const user = userEvent.setup();
    renderPage(
      Array.from({ length: 12 }, (_, index) =>
        item(index, index === 0 ? 'failed' : 'ready'),
      ),
    );
    await user.click(await screen.findByRole('button', { name: 'Failed 1' }));
    expect(
      screen.queryByRole('region', { name: 'Ready' }),
    ).not.toBeInTheDocument();
    await user.type(screen.getByRole('searchbox'), 'missing text');
    expect(
      screen.getByRole('heading', { name: 'No imports match' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByRole('region', { name: 'Ready' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(listImports).toHaveBeenCalledTimes(1);
  });

  it('test_imports_given_paste_success_expect_saved_ready_row', async () => {
    const user = userEvent.setup();
    const saved = item(1);
    renderPage([]);
    await user.click(
      await screen.findByRole('button', { name: 'Import text' }),
    );
    listImports.mockResolvedValue({
      items: [saved],
      nextCursor: null,
      quota: { used: 1, limit: 200 },
    });
    createPasteImport.mockResolvedValue(saved);
    await user.type(
      await screen.findByPlaceholderText('Paste text here…'),
      'En kort setning.',
    );
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Import',
      }),
    );
    expect(
      await screen.findByRole('link', { name: /En norsk artikkel 1/ }),
    ).toHaveAttribute('href', '/reading/story/story-1');
  });
});
