import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { server } from '@/test/msw/server';
import type { DeletionPreviewRead } from '@/types/api';

import { DeleteAccountModal } from './DeleteAccountModal';

const EMAIL = 'ola@example.com';

const PREVIEW: DeletionPreviewRead = {
  streak: 12,
  reviews: 1284,
  wordsPracticed: 340,
  importedTexts: 3,
};

function previewHandler(preview: DeletionPreviewRead = PREVIEW) {
  return http.get('*/users/me/deletion-preview', () =>
    HttpResponse.json(preview),
  );
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function renderModal(
  overrides: Partial<{
    onClose: () => void;
    onDeleted: () => void;
    onUnconfirmed: () => void;
  }> = {},
) {
  const onClose = overrides.onClose ?? vi.fn();
  const onDeleted = overrides.onDeleted ?? vi.fn();
  const onUnconfirmed = overrides.onUnconfirmed ?? vi.fn();

  render(
    <DeleteAccountModal
      email={EMAIL}
      isOpen
      onClose={onClose}
      onDeleted={onDeleted}
      onUnconfirmed={onUnconfirmed}
    />,
    { wrapper },
  );

  return { onClose, onDeleted, onUnconfirmed };
}

function deleteButton() {
  return screen.getByRole('button', { name: /^delete account$/i });
}

async function armTheModal() {
  await userEvent.type(screen.getByLabelText(/to confirm/i), EMAIL);
}

describe('DeleteAccountModal', () => {
  it('test_modal_given_counts_in_flight_expect_skeleton_and_locked_button', async () => {
    server.use(
      http.get(
        '*/users/me/deletion-preview',
        () => new Promise(() => {}) as never,
      ),
    );

    renderModal();

    expect(
      screen.getByRole('status', { name: /loading what deletion removes/i }),
    ).toBeInTheDocument();
    expect(deleteButton()).toBeDisabled();

    await armTheModal();
    expect(deleteButton()).toBeDisabled();
  });

  it('test_modal_given_counts_loaded_expect_enumerated_live_figures', async () => {
    server.use(previewHandler());

    renderModal();

    expect(await screen.findByText('1,284')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('340')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('test_modal_given_counts_failed_expect_dashes_and_labels_and_locked_button', async () => {
    server.use(
      http.get(
        '*/users/me/deletion-preview',
        () => new HttpResponse(null, { status: 500 }),
      ),
    );

    renderModal();

    expect(await screen.findByText('day streak')).toBeInTheDocument();
    expect(screen.getByText('reviews')).toBeInTheDocument();
    expect(screen.getByText('words practiced')).toBeInTheDocument();
    expect(screen.getByText('imported texts')).toBeInTheDocument();

    const dashes = screen.getAllByText('—');
    expect(dashes).toHaveLength(4);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(deleteButton()).toBeDisabled();

    await armTheModal();
    expect(deleteButton()).toBeDisabled();
  });

  it('test_modal_given_preview_failed_then_retried_expect_recovery_to_live_counts', async () => {
    let calls = 0;
    server.use(
      http.get('*/users/me/deletion-preview', () => {
        calls += 1;
        if (calls === 1) {
          return new HttpResponse(null, { status: 500 });
        }
        return HttpResponse.json(PREVIEW);
      }),
    );

    renderModal();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /could not load what deletion removes/i,
    );
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(deleteButton()).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByText('1,284')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('340')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    await armTheModal();
    await waitFor(() => expect(deleteButton()).toBeEnabled());
  });

  it('test_modal_given_a_mismatched_email_expect_the_delete_button_stays_locked', async () => {
    server.use(previewHandler());

    renderModal();

    await userEvent.type(
      screen.getByLabelText(/to confirm/i),
      'kari@example.com',
    );

    expect(deleteButton()).toBeDisabled();
    expect(
      screen.getByText(/stays unavailable until this matches/i),
    ).toBeInTheDocument();
  });

  it('test_modal_given_the_matching_email_expect_the_delete_button_unlocked', async () => {
    server.use(previewHandler());

    renderModal();
    await armTheModal();

    expect(deleteButton()).toBeEnabled();
  });

  it('test_delete_request_given_a_typed_email_expect_no_identifier_on_the_wire', async () => {
    let requestUrl: URL | undefined;
    let body = '';
    server.use(
      previewHandler(),
      http.delete('*/users/me', async ({ request }) => {
        requestUrl = new URL(request.url);
        body = await request.text();
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const { onDeleted } = renderModal();
    await armTheModal();
    await userEvent.click(deleteButton());

    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
    expect(requestUrl?.pathname).toBe('/users/me');
    expect(requestUrl?.search).toBe('');
    expect(body).toBe('');
  });

  it('test_delete_request_given_hook_clears_cache_expect_on_deleted_called_once', async () => {
    server.use(
      previewHandler(),
      http.delete('*/users/me', () => new HttpResponse(null, { status: 200 })),
    );

    const { onDeleted } = renderModal();
    await armTheModal();
    await userEvent.click(deleteButton());

    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
  });

  it('test_modal_given_a_request_in_flight_expect_both_buttons_disabled', async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      previewHandler(),
      http.delete('*/users/me', async () => {
        await held;
        return new HttpResponse(null, { status: 200 });
      }),
    );

    renderModal();
    await armTheModal();
    await userEvent.click(deleteButton());

    const inFlight = await screen.findByRole('button', { name: /deleting/i });
    expect(inFlight).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();

    release();
  });

  it('test_modal_given_a_failed_delete_expect_the_error_shown_in_place', async () => {
    server.use(
      previewHandler(),
      http.delete('*/users/me', () => new HttpResponse(null, { status: 500 })),
    );

    const { onDeleted } = renderModal();
    await armTheModal();
    await userEvent.click(deleteButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /nothing was removed/i,
    );
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('test_modal_given_no_response_to_the_delete_expect_an_unconfirmed_outcome', async () => {
    server.use(
      previewHandler(),
      http.delete('*/users/me', () => HttpResponse.error()),
    );

    const { onDeleted, onUnconfirmed } = renderModal();
    await armTheModal();
    await userEvent.click(deleteButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/may or may not have been deleted/i);
    expect(alert).not.toHaveTextContent(/nothing was removed/i);
    expect(onDeleted).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole('button', { name: /sign in again/i }),
    );
    expect(onUnconfirmed).toHaveBeenCalledTimes(1);
  });

  it('test_modal_given_a_gateway_timeout_expect_an_unconfirmed_outcome', async () => {
    server.use(
      previewHandler(),
      http.delete('*/users/me', () => new HttpResponse(null, { status: 504 })),
    );

    renderModal();
    await armTheModal();
    await userEvent.click(deleteButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /may or may not have been deleted/i,
    );
  });

  it('test_modal_given_cancel_expect_dismissal_without_a_request', async () => {
    server.use(previewHandler());

    const { onClose } = renderModal();
    await armTheModal();
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('test_modal_given_escape_expect_dismissal_without_a_request', async () => {
    server.use(previewHandler());

    const { onClose } = renderModal();
    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });
});
