import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { ImportItem } from '@/types/api';

import { ImportStatusCard } from './ImportStatusCard';

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

const { deleteImport, retryImport } = vi.hoisted(() => ({
  deleteImport: vi.fn().mockResolvedValue(undefined),
  retryImport: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/api/imports', () => ({
  deleteImport,
  retryImport,
}));

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

function renderCard(item: ImportItem) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ImportStatusCard item={item} />
    </QueryClientProvider>,
  );
}

describe('ImportStatusCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('test_import_card_given_ready_status_expect_clickable_link_to_reader', () => {
    renderCard(buildItem());

    const link = screen.getByRole('link', {
      name: /Historien om Norge/i,
    });
    expect(link).toHaveAttribute('href', '/reading/story/story-1');
    expect(link).toHaveTextContent('890 words · 4 pages · 18 Jul');
    expect(
      screen.getByRole('heading', { name: 'Historien om Norge' }),
    ).toHaveAttribute('lang', 'nb');
  });

  it('test_import_card_given_processing_status_expect_not_clickable_with_busy_announcement', () => {
    renderCard(buildItem({ status: 'processing' }));

    expect(
      screen.queryByRole('link', { name: /Historien om Norge/i }),
    ).not.toBeInTheDocument();
    const announced = screen.getByLabelText(/Historien om Norge: processing/i);
    expect(announced).toBeInTheDocument();
    expect(announced).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText(/Processing/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        'Turning it into a tap-to-read text. Usually under a minute.',
      ),
    ).toBeInTheDocument();
  });

  it('test_import_card_given_pending_status_expect_treated_as_processing', () => {
    renderCard(buildItem({ status: 'pending' }));

    expect(
      screen.queryByRole('link', { name: /Historien om Norge/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Processing/i)).toBeInTheDocument();
  });

  it('test_import_card_given_failed_status_expect_retry_and_delete_buttons', () => {
    renderCard(
      buildItem({
        status: 'failed',
        errorCode: 'PIPELINE_FAILED',
        errorMessage: 'Text was too short to process.',
      }),
    );

    expect(
      screen.getByText(/Text was too short to process./),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('test_import_card_given_retry_click_expect_retry_import_called', async () => {
    const user = userEvent.setup();
    renderCard(buildItem({ status: 'failed' }));

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(retryImport).toHaveBeenCalledWith('import-1');
    });
  });

  it('test_import_card_given_delete_click_expect_confirm_dialog_opened_not_immediate_delete', async () => {
    const user = userEvent.setup();
    renderCard(buildItem({ status: 'failed' }));

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(
      await screen.findByRole('heading', { name: /Delete this import\?/i }),
    ).toBeInTheDocument();
    expect(deleteImport).not.toHaveBeenCalled();
  });

  it('test_import_card_given_delete_click_then_confirm_expect_delete_import_called', async () => {
    const user = userEvent.setup();
    renderCard(buildItem({ status: 'failed' }));

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(deleteImport).toHaveBeenCalledWith('import-1');
    });
  });

  it('test_import_card_given_failed_with_no_error_message_expect_fallback_copy', () => {
    renderCard(
      buildItem({
        status: 'failed',
        errorCode: null,
        errorMessage: null,
      }),
    );

    expect(
      screen.getByText('This text could not be processed.'),
    ).toBeInTheDocument();
  });

  it('test_import_card_given_source_url_expect_cover_shows_domain', () => {
    renderCard(
      buildItem({ sourceUrl: 'https://www.example.no/path/to/article' }),
    );

    expect(screen.getByText('example.no')).toBeInTheDocument();
  });

  it('test_import_card_given_no_source_url_expect_cover_shows_pasted', () => {
    renderCard(buildItem({ sourceUrl: null }));

    expect(screen.getByText('Pasted text')).toBeInTheDocument();
  });

  it('test_import_card_given_failed_with_missing_error_message_expect_fallback_copy', () => {
    renderCard(buildItem({ status: 'failed', errorMessage: null }));

    expect(
      screen.getByText('This text could not be processed.'),
    ).toBeInTheDocument();
  });
});
