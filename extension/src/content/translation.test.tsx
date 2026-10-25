import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MsgResult } from '../lib/messages';
import { resetOverlay } from '../popup/overlay';
import { createTestShadowSurface } from '../test/shadowSurface';

vi.mock('@flyt/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@flyt/ui')>()),
  createShadowSurface: () => createTestShadowSurface(),
}));

Range.prototype.getBoundingClientRect = () => new DOMRect(10, 10, 20, 20);

await import('./index');
const onContentMessage = vi.mocked(chrome.runtime.onMessage.addListener).mock
  .calls[0]?.[0];
await import('../background/index');
const onBackgroundMessage = vi.mocked(chrome.runtime.onMessage.addListener).mock
  .calls[1]?.[0];
const onMenuClick = vi.mocked(chrome.contextMenus.onClicked.addListener).mock
  .calls[0]?.[0];

const fetchRequest = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.clearAllMocks();
  fetchRequest.mockReset();
  vi.spyOn(globalThis, 'fetch').mockImplementation(fetchRequest);
  vi.mocked(chrome.cookies.get).mockImplementation(async () => ({
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    secure: false,
    hostOnly: true,
    name: 'access_token',
    value: 'test-session',
    session: true,
    sameSite: 'lax',
    storeId: '0',
  }));
  vi.mocked(chrome.tabs.sendMessage).mockImplementation(
    async (_tabId, command) => {
      onContentMessage?.(command, {}, vi.fn());
    },
  );
  vi.mocked(chrome.runtime.sendMessage).mockImplementation(
    (message: unknown) =>
      new Promise<MsgResult>((resolve) => {
        onBackgroundMessage?.(message, {}, resolve);
      }),
  );
});

afterEach(() => {
  act(() => resetOverlay());
  vi.restoreAllMocks();
});

async function translateFromContextMenu(text: string) {
  await act(async () => {
    await onMenuClick?.(
      { menuItemId: 'flyt-translate', selectionText: text, editable: false },
      { id: 7 } as chrome.tabs.Tab,
    );
  });
}

describe('context menu translation', () => {
  it('test_context_translation_given_over_limit_selection_expect_sentence_notice_through_message_path', async () => {
    const translatedText = 'A translated prefix.';
    fetchRequest.mockResolvedValue(
      Response.json({
        source_text: 'Dette er norsk. '.repeat(125).trimEnd(),
        translated_text: translatedText,
        source_language: 'no',
        target_language: 'en',
      }),
    );

    await translateFromContextMenu(
      '  ' + 'Dette er norsk. '.repeat(130) + '  ',
    );

    expect(
      await screen.findByText('Translated the first 125 of 130 sentences.'),
    ).toBeVisible();
    expect(
      screen.getByRole('dialog', { name: 'Translate selected text' }),
    ).toBeVisible();
    expect(await screen.findByText(translatedText)).toBeVisible();
    expect(fetchRequest).toHaveBeenCalledExactlyOnceWith(
      'http://localhost:8000/extension/translate',
      expect.objectContaining({
        body: JSON.stringify({
          text: 'Dette er norsk. '.repeat(125).trimEnd(),
        }),
      }),
    );
  });

  it.each(['a', '1234', '!!! ???', '😀'])(
    'test_context_translation_given_untranslatable_selection_expect_translation_echo_without_api_or_retry',
    async (text) => {
      await translateFromContextMenu(text);

      expect(
        await screen.findByRole('dialog', { name: 'Translate selected text' }),
      ).toBeVisible();
      expect(
        await screen.findByText(text, { selector: '[lang=en]' }),
      ).toBeVisible();
      expect(fetchRequest).not.toHaveBeenCalled();
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Try again' }),
      ).not.toBeInTheDocument();
    },
  );

  it.each([
    { status: 413, code: 'REQUEST_TOO_LARGE', text: 'Jeg leser en bok.' },
    {
      status: 422,
      code: 'EXTENSION_TRANSLATION_INVALID',
      text: 'https://example.com/' + 'path/'.repeat(200),
    },
  ])(
    'test_context_translation_given_rejected_input_expect_source_echo_without_error_or_retry',
    async ({ status, code, text }) => {
      fetchRequest.mockResolvedValue(
        Response.json(
          {
            detail: { code, message: 'This selection cannot be translated.' },
          },
          { status },
        ),
      );

      await translateFromContextMenu(text);

      expect(
        await screen.findByText(text, { selector: '[lang=en]' }),
      ).toBeVisible();
      expect(fetchRequest).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Try again' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: 'Open Flyt' }),
      ).not.toBeInTheDocument();
    },
  );
});
