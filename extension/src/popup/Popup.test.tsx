import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MSG_KIND, MSG_RESULT_KIND, type MsgResult } from '../lib/messages';
import type { ResolveResponse } from '../lib/resolve-types';
import { Popup, type PopupState } from './Popup';

// The lookup views pull in @flyt/lexicon / @flyt/ui; stub them so the test
// focuses on Popup's import-action state machine, not their internals.
vi.mock('@flyt/lexicon', () => ({
  LemmaHeader: () => null,
  DefinitionView: () => null,
  SearchBar: () => null,
  LemmaCardView: ({ lemma }: { lemma: { word: string } }) => (
    <div>{lemma.word} dictionary</div>
  ),
}));
vi.mock('@flyt/ui', () => ({
  Button: ({
    children,
    disabled,
    onClick,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button type="button" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
}));

const RESULT_STATE: PopupState = {
  kind: 'result',
  res: { query: 'ord', candidates: [] } as ResolveResponse,
};
const LOADING_STATE: PopupState = { kind: 'loading', word: 'annet' };

/** A promise whose resolve is exposed so the test controls import timing. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const SELECTION_STATE: PopupState = {
  kind: 'selection',
  selection: {
    source_sentence: 'Jeg leser en bok hver dag.',
    source_title: 'Artikkel',
  },
};

beforeEach(() => {
  vi.mocked(chrome.runtime.sendMessage).mockReset();
});

describe('Popup import action', () => {
  it('test_popup_given_lookup_transition_during_import_expect_button_stays_disabled', async () => {
    const user = userEvent.setup();
    const gate = deferred<MsgResult>();
    const onImportPage = vi.fn(() => gate.promise);

    const { rerender } = render(
      <Popup state={RESULT_STATE} onImportPage={onImportPage} />,
    );

    // Start the import: the button flips to Saving this page… and disables.
    await user.click(screen.getByRole('button', { name: 'Import this page' }));
    const importing = screen.getByRole('button', { name: 'Saving this page…' });
    expect(importing).toBeDisabled();

    // A lookup transition (result -> loading) must NOT reset the import state
    // (the pre-fix bug re-enabled the button mid-flight, allowing double POSTs).
    rerender(<Popup state={LOADING_STATE} onImportPage={onImportPage} />);
    expect(screen.getByRole('button', { name: 'Saving this page…' })).toBeDisabled();
    expect(onImportPage).toHaveBeenCalledTimes(1);

    // Completing the import shows success.
    gate.resolve({ ok: true, kind: MSG_RESULT_KIND.IMPORTED });
    await waitFor(() =>
      expect(screen.getByText('Page saved')).toBeInTheDocument(),
    );
    expect(
      screen.getByText(
        'We’ll prepare it for reading. You can keep browsing.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'View in Flyt' }),
    ).toBeInTheDocument();
  });

  it('test_popup_given_import_failure_expect_error_message_and_reenabled', async () => {
    const user = userEvent.setup();
    const onImportPage = vi.fn<() => Promise<MsgResult>>(() =>
      Promise.resolve({ ok: false, error: 'too-large' }),
    );

    render(<Popup state={RESULT_STATE} onImportPage={onImportPage} />);
    await user.click(screen.getByRole('button', { name: 'Import this page' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'This page is too large to import.',
      ),
    );
    // Re-enabled so the user can retry.
    expect(
      screen.getByRole('button', { name: 'Import this page' }),
    ).not.toBeDisabled();
  });

  it('test_popup_given_open_expect_dialog_is_modal', () => {
    render(<Popup state={RESULT_STATE} onImportPage={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});

describe('Popup sentence word lookup', () => {
  it('test_sentence_word_given_lookup_failure_expect_retryable_feedback', async () => {
    const user = userEvent.setup();
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(async (message) => {
      const msg = message as unknown as { kind: string };
      if (msg.kind === MSG_KIND.TRANSLATE) {
        return {
          ok: true,
          kind: MSG_RESULT_KIND.TRANSLATED,
          data: {
            source_text: 'Jeg leser en bok hver dag.',
            translated_text: 'I read a book every day.',
            source_language: 'no',
            target_language: 'en',
          },
        };
      }
      return { ok: false, error: 'network' };
    });

    render(<Popup state={SELECTION_STATE} onImportPage={vi.fn()} />);
    await screen.findByText('I read a book every day.');
    await user.click(screen.getByRole('button', { name: 'bok' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Could not find "bok".',
      ),
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible();
    expect(screen.getByText('I read a book every day.')).toBeVisible();
  });

  it('test_sentence_word_given_lookup_success_expect_result_and_back_control', async () => {
    const user = userEvent.setup();
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(async (message) => {
      const msg = message as unknown as { kind: string };
      if (msg.kind === MSG_KIND.TRANSLATE) {
        return {
          ok: true,
          kind: MSG_RESULT_KIND.TRANSLATED,
          data: {
            source_text: 'Jeg leser en bok hver dag.',
            translated_text: 'I read a book every day.',
            source_language: 'no',
            target_language: 'en',
          },
        };
      }
      if (msg.kind === MSG_KIND.RESOLVE) {
        return {
          ok: true,
          kind: MSG_RESULT_KIND.RESOLVE,
          data: {
            query: 'bok',
            candidates: [
              {
                lemma_uuid: '3f1c8a2e-9b40-4c1d-8f77-2a5b6c7d8e90',
                word: 'bok',
                pos: 'noun',
                hgno: 1,
                definitions: [],
              },
            ],
          },
        };
      }
      return { ok: false, error: 'network' };
    });

    render(<Popup state={SELECTION_STATE} onImportPage={vi.fn()} />);
    await screen.findByText('I read a book every day.');
    await user.click(screen.getByRole('button', { name: 'bok' }));

    expect(await screen.findByText('bok dictionary')).toBeVisible();
    const back = screen.getByRole('button', { name: 'Back to translation' });
    await user.click(back);
    expect(screen.queryByText('bok dictionary')).not.toBeInTheDocument();
    expect(screen.getByText('I read a book every day.')).toBeVisible();
  });

  it('test_sentence_word_given_empty_lookup_expect_search_instead_of_retry', async () => {
    const user = userEvent.setup();
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(async (message) => {
      const msg = message as unknown as { kind: string };
      if (msg.kind === MSG_KIND.TRANSLATE) {
        return {
          ok: true,
          kind: MSG_RESULT_KIND.TRANSLATED,
          data: {
            source_text: 'Jeg leser en bok hver dag.',
            translated_text: 'I read a book every day.',
            source_language: 'no',
            target_language: 'en',
          },
        };
      }
      return {
        ok: true,
        kind: MSG_RESULT_KIND.RESOLVE,
        data: { query: 'bok', candidates: [] },
      };
    });

    render(<Popup state={SELECTION_STATE} onImportPage={vi.fn()} />);
    await screen.findByText('I read a book every day.');
    await user.click(screen.getByRole('button', { name: 'bok' }));

    expect(
      await screen.findByText('No dictionary entry for "bok".'),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(screen.queryByText('No dictionary entry for "bok".')).toBeNull();
  });
});
