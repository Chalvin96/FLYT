import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ImportTextSheet } from './ImportTextSheet';

const desktopState = vi.hoisted(() => ({ value: false }));

vi.mock('@/hooks/ui/useIsDesktop', () => ({
  useIsDesktop: () => desktopState.value,
}));

const { createPasteImport, showApiError } = vi.hoisted(() => ({
  createPasteImport: vi.fn(),
  showApiError: vi.fn(),
}));

vi.mock('@/api/imports', () => ({
  createPasteImport,
}));

vi.mock('@/lib/errors', () => ({
  showApiError,
}));

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function buildQuotaError() {
  return Object.assign(new Error('Request failed'), {
    isAxiosError: true,
    response: {
      status: 429,
      data: {
        detail: {
          code: 'IMPORT_QUOTA_EXCEEDED',
          message: 'Import limit reached.',
        },
      },
    },
    config: {},
  });
}

function buildTooLargeError() {
  return Object.assign(new Error('Request failed'), {
    isAxiosError: true,
    response: {
      status: 413,
      data: {
        detail: {
          code: 'IMPORT_TOO_LARGE',
          message: 'Text exceeds the size limit.',
        },
      },
    },
    config: {},
  });
}

function renderSheet(
  propsOverride: Partial<React.ComponentProps<typeof ImportTextSheet>> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onOpenChange = vi.fn();
  return render(
    <QueryClientProvider client={queryClient}>
      <ImportTextSheet isOpen onOpenChange={onOpenChange} {...propsOverride} />
    </QueryClientProvider>,
  );
}

describe('ImportTextSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    desktopState.value = false;
    createPasteImport.mockResolvedValue({
      id: 'import-1',
      storyUuid: 'story-1',
      title: 'Pasted',
      sourceUrl: null,
      status: 'pending',
      errorCode: null,
      errorMessage: null,
      pageCount: null,
      wordCount: 0,
      createdAt: '2026-07-20T10:00:00Z',
    });
  });

  it('test_import_sheet_given_empty_text_expect_submit_disabled', () => {
    renderSheet();

    const submit = screen.getByRole('button', { name: 'Import' });
    expect(submit).toBeDisabled();
  });

  it('test_import_sheet_given_text_under_limit_expect_kb_counter_and_enabled_submit', async () => {
    const user = userEvent.setup();
    renderSheet();

    const textarea = screen.getByPlaceholderText('Paste text here…');
    await user.type(textarea, 'Klimaendringene i Arktis skjer raskt.');

    // Counter renders and shows the server's 100_000-byte cap rendered as KB
    // (100_000 / 1024 ≈ 97.7 KB, NOT 100 KB — the old test asserted the wrong
    // number because the constant used to be 102_400).
    const counter = screen.getByText(/\/ 97\.7 KB$/);
    expect(counter).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled();
  });

  it('test_import_sheet_given_text_at_100_000_bytes_expect_submit_enabled', () => {
    // Boundary: the server caps NORMALIZED text at exactly 100_000 bytes.
    // A 100_000 ASCII-char string normalizes to itself (no whitespace), so
    // byte length === 100_000 and the client must NOT block.
    renderSheet();
    const textarea = screen.getByPlaceholderText(
      'Paste text here…',
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, {
      target: { value: 'a'.repeat(100_000) },
    });

    expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled();
  });

  it('test_import_sheet_given_text_at_100_001_bytes_expect_submit_blocked', () => {
    // Boundary: one byte over the server cap must be client-side blocked.
    renderSheet();
    const textarea = screen.getByPlaceholderText(
      'Paste text here…',
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, {
      target: { value: 'a'.repeat(100_001) },
    });

    expect(screen.getByText(/too long by/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it('test_import_sheet_given_multibyte_text_expect_byte_count_not_char_count', () => {
    // The Norwegian `ø` is 2 UTF-8 bytes; the cap is on BYTES, not chars.
    // A short string of multibyte chars still has to be measured in bytes.
    renderSheet();
    const textarea = screen.getByPlaceholderText(
      'Paste text here…',
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, {
      target: { value: 'ø'.repeat(50_000) },
    });

    // 50_000 * 2 bytes = 100_000 bytes — exactly at the cap, not over it.
    expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled();
  });

  it('test_import_sheet_given_text_over_100_kb_expect_submit_blocked_with_over_message', () => {
    renderSheet();

    const textarea = screen.getByPlaceholderText(
      'Paste text here…',
    ) as HTMLTextAreaElement;
    // 1024 * 101 = 101 KB of single-byte chars, over the 100 KB cap.
    // Use fireEvent.change (not userEvent.type) because typing 100k chars
    // one keystroke at a time is far too slow for a unit test.
    fireEvent.change(textarea, {
      target: { value: 'a'.repeat(1024 * 101) },
    });

    const counter = screen.getByText(/too long by/);
    expect(counter).toBeInTheDocument();

    // Submit is client-side blocked before the request fires (D-004).
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it('test_import_sheet_given_successful_submit_expect_close_called', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <ImportTextSheet isOpen onOpenChange={onOpenChange} />
      </QueryClientProvider>,
    );

    await user.type(
      screen.getByPlaceholderText('Paste text here…'),
      'En kort setning.',
    );
    await user.click(screen.getByRole('button', { name: 'Import' }));

    await waitFor(() => {
      expect(createPasteImport).toHaveBeenCalledWith({
        title: undefined,
        text: 'En kort setning.',
      });
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('test_import_sheet_given_429_quota_exceeded_expect_quota_dialog_rendered', async () => {
    const user = userEvent.setup();
    createPasteImport.mockRejectedValue(buildQuotaError());

    renderSheet();

    await user.type(
      screen.getByPlaceholderText('Paste text here…'),
      'En kort setning.',
    );
    await user.click(screen.getByRole('button', { name: 'Import' }));

    // The quota-reached dialog replaces the form.
    expect(
      await screen.findByRole('heading', { name: 'Import limit reached' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/existing imports stay/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Got it' })).toBeInTheDocument();
  });

  it('test_import_sheet_given_413_too_large_error_expect_error_toast_rendered', async () => {
    const user = userEvent.setup();
    createPasteImport.mockRejectedValue(buildTooLargeError());

    renderSheet();

    await user.type(
      screen.getByPlaceholderText('Paste text here…'),
      'En kort setning.',
    );
    await user.click(screen.getByRole('button', { name: 'Import' }));

    // 413 is the server backstop; it surfaces via showApiError, not the
    // quota dialog. The form stays open so the user can edit.
    await waitFor(() => {
      expect(showApiError).toHaveBeenCalled();
    });
    expect(
      screen.queryByRole('heading', { name: 'Import limit reached' }),
    ).not.toBeInTheDocument();
  });

  it('test_import_sheet_given_cancel_click_expect_on_open_change_false', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <ImportTextSheet isOpen onOpenChange={onOpenChange} />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('test_import_sheet_given_title_input_expect_title_passed_on_submit', async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.type(
      screen.getByPlaceholderText('Title (optional)'),
      'Min artikkel',
    );
    await user.type(
      screen.getByPlaceholderText('Paste text here…'),
      'Norsk tekst her.',
    );
    await user.click(screen.getByRole('button', { name: 'Import' }));

    await waitFor(() => {
      expect(createPasteImport).toHaveBeenCalledWith({
        title: 'Min artikkel',
        text: 'Norsk tekst her.',
      });
    });
  });

  it('test_import_sheet_given_submit_bypassing_disabled_button_expect_oversize_text_not_sent', async () => {
    // A form submit never consults the button's disabled state.
    renderSheet();

    const textarea = screen.getByPlaceholderText(
      'Paste text here…',
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'a'.repeat(100_001) } });
    fireEvent.submit(textarea);
    await settle();

    expect(createPasteImport).not.toHaveBeenCalled();
  });

  it('test_import_sheet_given_submit_with_whitespace_only_text_expect_nothing_sent', async () => {
    renderSheet();

    const textarea = screen.getByPlaceholderText(
      'Paste text here…',
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '   \n\n  ' } });
    fireEvent.submit(textarea);
    await settle();

    expect(createPasteImport).not.toHaveBeenCalled();
  });

  it('test_import_sheet_given_textarea_expect_required_and_aria_required', () => {
    // The textarea must expose its required-ness to assistive tech.
    renderSheet();

    const textarea = screen.getByPlaceholderText('Paste text here…');
    expect(textarea).toHaveAttribute('required');
    expect(textarea).toHaveAttribute('aria-required', 'true');
    // An sr-only "(required)" label is present for screen readers.
    expect(screen.getByText('(required)')).toBeInTheDocument();
  });
});
