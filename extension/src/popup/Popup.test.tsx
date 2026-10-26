import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MSG_KIND,
  MSG_RESULT_KIND,
  sendMessage,
  type MsgResult,
} from '../lib/messages';
import { Popup, type PopupState } from './Popup';

vi.mock('../lib/messages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/messages')>()),
  sendMessage: vi.fn(),
}));

const RESULT_STATE: PopupState = {
  kind: 'result',
  res: { query: 'ord', candidates: [] },
};
const LOADING_STATE: PopupState = { kind: 'loading', word: 'annet' };

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

const REPEATED_WORD_STATE: PopupState = {
  kind: 'selection',
  selection: {
    source_sentence: 'Jeg leser bok, og bok.',
    source_title: 'Artikkel',
  },
};

const TRANSLATION: MsgResult = {
  ok: true,
  kind: MSG_RESULT_KIND.TRANSLATED,
  data: {
    source_text: 'Jeg leser en bok hver dag.',
    translated_text: 'I read a book every day.',
    source_language: 'no',
    target_language: 'en',
  },
};

const BOOK_RESOLVED: MsgResult = {
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

const BOOK_NOT_FOUND: MsgResult = {
  ok: true,
  kind: MSG_RESULT_KIND.RESOLVE,
  data: { query: 'bok', candidates: [] },
};

function stubResolve(reply: MsgResult): void {
  vi.mocked(sendMessage).mockImplementation(async (message) => {
    return message.kind === MSG_KIND.RESOLVE ? reply : TRANSLATION;
  });
}

beforeEach(() => {
  vi.mocked(sendMessage).mockReset();
});

describe('Popup import action', () => {
  it('test_popup_given_old_import_finishes_during_new_session_expect_current_import_still_pending', async () => {
    const user = userEvent.setup();
    const oldImport = deferred<MsgResult>();
    const currentImport = deferred<MsgResult>();
    const onImportPage = vi
      .fn()
      .mockReturnValueOnce(oldImport.promise)
      .mockReturnValueOnce(currentImport.promise);
    const { rerender } = render(
      <Popup state={RESULT_STATE} onImportPage={onImportPage} sessionId={0} />,
    );
    await user.click(screen.getByRole('button', { name: 'Import page' }));
    rerender(
      <Popup state={RESULT_STATE} onImportPage={onImportPage} sessionId={1} />,
    );
    await user.click(screen.getByRole('button', { name: 'Import page' }));
    await act(async () => {
      oldImport.resolve({ ok: true, kind: MSG_RESULT_KIND.IMPORTED });
    });
    expect(
      screen.getByRole('button', { name: 'Saving this page…' }),
    ).toBeDisabled();
    expect(screen.queryByText('Page saved')).not.toBeInTheDocument();
    await act(async () => {
      currentImport.resolve({ ok: true, kind: MSG_RESULT_KIND.IMPORTED });
    });
    expect(screen.getByText('Page saved')).toBeVisible();
  });

  it('test_popup_given_lookup_transition_during_import_expect_button_stays_disabled', async () => {
    const user = userEvent.setup();
    const gate = deferred<MsgResult>();
    const onImportPage = vi.fn(() => gate.promise);

    const { rerender } = render(
      <Popup state={RESULT_STATE} onImportPage={onImportPage} />,
    );

    await user.click(screen.getByRole('button', { name: 'Import page' }));
    const importing = screen.getByRole('button', { name: 'Saving this page…' });
    expect(importing).toBeDisabled();

    rerender(<Popup state={LOADING_STATE} onImportPage={onImportPage} />);
    expect(
      screen.getByRole('button', { name: 'Saving this page…' }),
    ).toBeDisabled();
    expect(onImportPage).toHaveBeenCalledTimes(1);

    gate.resolve({ ok: true, kind: MSG_RESULT_KIND.IMPORTED });
    await waitFor(() =>
      expect(screen.getByText('Page saved')).toBeInTheDocument(),
    );
    expect(
      screen.getByText('We’ll prepare it for reading. You can keep browsing.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'View in Flyt' }),
    ).toBeInTheDocument();
  });

  it.each(['too-large', 'invalid-page', 'quota-reached'] as const)(
    'test_popup_given_nonretryable_import_failure_expect_backend_message_and_open_flyt',
    async (error) => {
      const user = userEvent.setup();
      const onImportPage = vi.fn<() => Promise<MsgResult>>(() =>
        Promise.resolve({
          ok: false,
          error,
          message: 'This import is unavailable.',
        }),
      );

      render(<Popup state={RESULT_STATE} onImportPage={onImportPage} />);
      await user.click(screen.getByRole('button', { name: 'Import page' }));

      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(
          'This import is unavailable.',
        ),
      );
      expect(
        screen.queryByRole('button', { name: 'Import page' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Try again' }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Open Flyt' })).toHaveAttribute(
        'href',
        'http://localhost:5173',
      );
    },
  );

  it.each([
    { error: 'network', openFlyt: false },
    { error: 'unknown', openFlyt: true },
  ] as const)(
    'test_popup_given_retryable_import_failure_expect_recovery_and_success',
    async ({ error, openFlyt }) => {
      const user = userEvent.setup();
      const onImportPage = vi
        .fn<() => Promise<MsgResult>>()
        .mockResolvedValueOnce({
          ok: false,
          error,
          message: 'private diagnostic',
        })
        .mockResolvedValueOnce({ ok: true, kind: MSG_RESULT_KIND.IMPORTED });
      render(<Popup state={RESULT_STATE} onImportPage={onImportPage} />);
      await user.click(screen.getByRole('button', { name: 'Import page' }));
      expect(await screen.findByRole('alert')).not.toHaveTextContent(
        'private diagnostic',
      );
      expect(Boolean(screen.queryByRole('link', { name: 'Open Flyt' }))).toBe(
        openFlyt,
      );
      await user.click(screen.getByRole('button', { name: 'Try again' }));
      expect(await screen.findByText('Page saved')).toBeVisible();
      expect(onImportPage).toHaveBeenCalledTimes(2);
    },
  );

  it('test_popup_given_open_expect_exactly_one_dialog_named_for_the_state', () => {
    render(<Popup state={RESULT_STATE} onImportPage={vi.fn()} />);

    const dialogs = screen.getAllByRole('dialog');
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0]).toHaveAccessibleName('Definition of ord');
  });
});

describe('Popup sentence word lookup', () => {
  it('test_sentence_word_given_lookup_failure_expect_retryable_feedback', async () => {
    const user = userEvent.setup();
    stubResolve({ ok: false, error: 'network' });

    render(<Popup state={SELECTION_STATE} onImportPage={vi.fn()} />);
    await screen.findByText('I read a book every day.');
    await user.click(screen.getByRole('button', { name: 'bok' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        "Can't reach Flyt. Check your connection.",
      ),
    );
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
    expect(screen.getByText('I read a book every day.')).toBeVisible();
  });

  it('test_sentence_word_given_current_word_clicked_again_expect_result_dismissed', async () => {
    const user = userEvent.setup();
    stubResolve(BOOK_RESOLVED);

    render(<Popup state={SELECTION_STATE} onImportPage={vi.fn()} />);
    await screen.findByText('I read a book every day.');
    await user.click(screen.getByRole('button', { name: 'bok' }));

    expect(
      await screen.findByRole('article', { name: 'bok dictionary' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'bok' }));
    expect(
      screen.queryByRole('article', { name: 'bok dictionary' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('I read a book every day.')).toBeVisible();
  });

  it('test_sentence_word_given_empty_lookup_expect_search_instead_of_retry', async () => {
    const user = userEvent.setup();
    stubResolve(BOOK_NOT_FOUND);

    render(<Popup state={SELECTION_STATE} onImportPage={vi.fn()} />);
    await screen.findByText('I read a book every day.');
    await user.click(screen.getByRole('button', { name: 'bok' }));

    expect(
      await screen.findByText('No dictionary entry for "bok".'),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Search for "bok"' }));
    expect(screen.queryByText('No dictionary entry for "bok".')).toBeNull();
  });

  it('test_sentence_word_given_one_word_twice_expect_only_the_tapped_occurrence_current', async () => {
    const user = userEvent.setup();
    stubResolve(BOOK_RESOLVED);

    render(<Popup state={REPEATED_WORD_STATE} onImportPage={vi.fn()} />);
    await screen.findByText('I read a book every day.');
    const tokens = screen.getAllByRole('button', { name: 'bok' });
    await user.click(tokens[1]!);

    await screen.findByRole('article', { name: 'bok dictionary' });
    expect(tokens[0]).not.toHaveAttribute('aria-current');
    expect(tokens[1]).toHaveAttribute('aria-current', 'true');
  });

  it('test_sentence_word_given_result_shown_expect_current_until_the_result_is_dismissed', async () => {
    const user = userEvent.setup();
    stubResolve(BOOK_RESOLVED);

    render(<Popup state={REPEATED_WORD_STATE} onImportPage={vi.fn()} />);
    await screen.findByText('I read a book every day.');
    const tokens = screen.getAllByRole('button', { name: 'bok' });
    await user.click(tokens[1]!);

    await screen.findByRole('article', { name: 'bok dictionary' });
    expect(tokens[1]).toHaveAttribute('aria-current', 'true');

    await user.click(tokens[1]!);
    expect(tokens[1]).not.toHaveAttribute('aria-current');
  });

  it('test_sentence_word_given_lookup_success_expect_the_entry_announced', async () => {
    const user = userEvent.setup();
    stubResolve(BOOK_RESOLVED);

    render(<Popup state={SELECTION_STATE} onImportPage={vi.fn()} />);
    await screen.findByText('I read a book every day.');
    await user.click(screen.getByRole('button', { name: 'bok' }));

    const announcement = await screen.findByText(
      'Showing the entry for "bok".',
    );
    expect(announcement).toHaveAttribute('role', 'status');
  });

  it('test_sentence_word_given_current_word_clicked_again_expect_the_tapped_occurrence_focused', async () => {
    const user = userEvent.setup();
    stubResolve(BOOK_RESOLVED);

    render(<Popup state={REPEATED_WORD_STATE} onImportPage={vi.fn()} />);
    await screen.findByText('I read a book every day.');
    const tokens = screen.getAllByRole('button', { name: 'bok' });
    await user.click(tokens[1]!);

    await screen.findByRole('article', { name: 'bok dictionary' });
    await user.click(tokens[1]!);

    expect(tokens[1]).toHaveFocus();
  });
});
