import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  LEMMA_CONTEXT_MAX_SENTENCE_LENGTH,
  LEMMA_CONTEXT_MAX_TITLE_LENGTH,
  TAB_CMD,
  boundLemmaContext,
  sendTabCommand,
} from './messages';

afterEach(() => vi.restoreAllMocks());

describe('sendTabCommand', () => {
  it('test_tab_command_given_receiver_expect_delivered', async () => {
    const sendMessage = vi
      .spyOn(chrome.tabs, 'sendMessage')
      .mockResolvedValue(undefined as never);
    await expect(
      sendTabCommand(7, { kind: TAB_CMD.RUN_IMPORT }),
    ).resolves.toEqual({ delivered: true });
    expect(sendMessage).toHaveBeenCalledWith(7, { kind: 'runImport' });
  });

  it('test_tab_command_given_no_receiver_expect_not_delivered', async () => {
    vi.spyOn(chrome.tabs, 'sendMessage').mockRejectedValue(
      new Error(
        'Could not establish connection. Receiving end does not exist.',
      ),
    );
    await expect(
      sendTabCommand(7, { kind: TAB_CMD.SHOW_FOR, word: 'ord' }),
    ).resolves.toEqual({ delivered: false });
  });
});

describe('boundLemmaContext', () => {
  it('test_context_given_long_browser_metadata_expect_saveable_bounds', () => {
    const context = boundLemmaContext({
      source_sentence: 'a'.repeat(LEMMA_CONTEXT_MAX_SENTENCE_LENGTH + 1),
      source_title: ' title '.repeat(100),
    });

    expect(context.source_sentence).toHaveLength(
      LEMMA_CONTEXT_MAX_SENTENCE_LENGTH,
    );
    expect(context.source_title?.length).toBe(300);
  });

  it('test_context_given_emoji_at_bounds_expect_well_formed_values', () => {
    const context = boundLemmaContext({
      source_sentence:
        'a'.repeat(LEMMA_CONTEXT_MAX_SENTENCE_LENGTH - 1) + '😀' + 'tail',
      source_title:
        'b'.repeat(LEMMA_CONTEXT_MAX_TITLE_LENGTH - 1) + '📖' + 'tail',
    });

    expect(Array.from(context.source_sentence)).toHaveLength(
      LEMMA_CONTEXT_MAX_SENTENCE_LENGTH,
    );
    expect(Array.from(context.source_title ?? '')).toHaveLength(
      LEMMA_CONTEXT_MAX_TITLE_LENGTH,
    );
    expect(context.source_sentence.endsWith('😀')).toBe(true);
    expect(context.source_title?.endsWith('📖')).toBe(true);
  });
});
