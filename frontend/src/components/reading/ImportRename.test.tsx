import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw/http';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useImports } from '@/hooks/imports/queries';
import { buildImportItem, buildImportList } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';

import { ImportStatusCard } from './ImportStatusCard';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => (
    <a href="/reading/story/story-1">{children}</a>
  ),
}));

function renderImport() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Harness() {
    const imports = useImports({});
    return imports.data?.items.map((item) => (
      <ImportStatusCard key={item.id} item={item} />
    ));
  }
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness />
    </QueryClientProvider>,
  );
}

describe('Inline import rename', () => {
  it('test_rename_given_enter_expect_title_persisted_and_editor_closed', async () => {
    const user = userEvent.setup();
    let item = buildImportItem();
    let submitted: unknown;
    server.use(
      http.get('*/imports', () => HttpResponse.json(buildImportList([item]))),
      http.patch('*/imports/import-1', async ({ request }) => {
        submitted = await request.json();
        item = { ...item, title: 'Min nye tittel' };
        return HttpResponse.json(item);
      }),
    );
    renderImport();
    await user.click(
      await screen.findByRole('button', {
        name: 'Rename Et importert dokument',
      }),
    );
    const field = screen.getByRole('textbox', { name: 'Import title' });
    expect(field).toHaveFocus();
    await user.clear(field);
    await user.type(field, 'Min nye tittel{Enter}');
    await screen.findByRole('button', { name: 'Rename Min nye tittel' });
    expect(submitted).toEqual({ title: 'Min nye tittel' });
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveTextContent('Min nye tittel');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Rename Min nye tittel' }),
      ).toHaveFocus(),
    );
  });

  it('test_rename_given_escape_expect_draft_discarded_without_request', async () => {
    const user = userEvent.setup();
    const patch = vi.fn();
    server.use(
      http.patch('*/imports/import-1', () => {
        patch();
        return HttpResponse.json(buildImportItem());
      }),
    );
    renderImport();
    await user.click(
      await screen.findByRole('button', {
        name: 'Rename Et importert dokument',
      }),
    );
    const field = screen.getByRole('textbox', { name: 'Import title' });
    await user.clear(field);
    await user.type(field, 'Uncommitted{Escape}');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Et importert dokument' }),
    ).toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();
  });

  it('test_rename_given_pending_save_expect_controls_disabled_until_persisted', async () => {
    const user = userEvent.setup();
    let complete: () => void = () => {};
    const pending = new Promise<void>((resolve) => {
      complete = resolve;
    });
    server.use(
      http.patch('*/imports/import-1', async () => {
        await pending;
        return HttpResponse.json(buildImportItem({ title: 'Min nye tittel' }));
      }),
    );
    renderImport();
    await user.click(
      await screen.findByRole('button', {
        name: 'Rename Et importert dokument',
      }),
    );
    const field = screen.getByRole('textbox', { name: 'Import title' });
    await user.clear(field);
    await user.type(field, 'Min nye tittel{Enter}');
    expect(
      await screen.findByRole('button', { name: 'Saving…' }),
    ).toBeDisabled();
    expect(field).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    complete();
    await waitFor(() =>
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument(),
    );
  });

  it('test_rename_given_cancel_expect_original_title_and_focus_restored', async () => {
    const user = userEvent.setup();
    renderImport();
    await user.click(
      await screen.findByRole('button', {
        name: 'Rename Et importert dokument',
      }),
    );
    await user.clear(screen.getByRole('textbox', { name: 'Import title' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Rename Et importert dokument' }),
      ).toHaveFocus(),
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('test_rename_given_empty_draft_expect_save_disabled', async () => {
    const user = userEvent.setup();
    renderImport();
    await user.click(
      await screen.findByRole('button', {
        name: 'Rename Et importert dokument',
      }),
    );
    const field = screen.getByRole('textbox', { name: 'Import title' });
    await user.clear(field);
    await user.type(field, '   ');
    expect(screen.getByRole('button', { name: 'Save title' })).toBeDisabled();
    expect(field).toHaveAttribute('maxLength', '200');
  });

  it('test_rename_given_server_failure_expect_inline_error_and_draft_retained', async () => {
    const user = userEvent.setup();
    server.use(
      http.patch('*/imports/import-1', () =>
        HttpResponse.json(
          { detail: { message: 'Please try again.' } },
          { status: 503 },
        ),
      ),
    );
    renderImport();
    await user.click(
      await screen.findByRole('button', {
        name: 'Rename Et importert dokument',
      }),
    );
    const field = screen.getByRole('textbox', { name: 'Import title' });
    await user.clear(field);
    await user.type(field, 'Min nye tittel{Enter}');
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Please try again.'),
    );
    expect(field).toHaveValue('Min nye tittel');
    expect(screen.getByRole('button', { name: 'Save title' })).toBeEnabled();
  });
});
