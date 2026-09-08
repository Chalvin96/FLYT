import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../lib/api';
import {
  LEMMA_CONTEXT_MAX_SENTENCE_LENGTH,
  MSG_KIND,
  MSG_RESULT_KIND,
  type Msg,
  type MsgResult,
} from '../lib/messages';

const api = vi.hoisted(() => ({
  addToDeck: vi.fn(),
  getLemmaDefinitions: vi.fn(),
  importPage: vi.fn(),
  markLemmaKnown: vi.fn(),
  resolveWord: vi.fn(),
  searchSuggestions: vi.fn(),
  translateSelection: vi.fn(),
}));
const { openLogin } = vi.hoisted(() => ({ openLogin: vi.fn() }));
const { sendTabCommand } = vi.hoisted(() => ({ sendTabCommand: vi.fn() }));

vi.mock('../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api')>()),
  ...api,
}));
vi.mock('../lib/auth', () => ({ openLogin }));
vi.mock('../lib/messages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/messages')>()),
  sendTabCommand,
}));

const UUID = '3f1c8a2e-9b40-4c1d-8f77-2a5b6c7d8e90';

type MessageListener = (
  msg: Msg,
  sender: unknown,
  sendResponse: (result: MsgResult) => void,
) => boolean;

type MenuListener = (
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab,
) => void;

type ActionListener = (tab: chrome.tabs.Tab) => void;

// The service worker registers its listeners at import time.
await import('./index');
const onMessage = vi.mocked(chrome.runtime.onMessage.addListener).mock
  .calls[0]?.[0] as MessageListener;
const onMenuClick = vi.mocked(chrome.contextMenus.onClicked.addListener).mock
  .calls[0]?.[0] as MenuListener;
const onActionClick = vi.mocked(chrome.action.onClicked.addListener).mock
  .calls[0]?.[0] as ActionListener;
const onInstalled = vi.mocked(chrome.runtime.onInstalled.addListener).mock
  .calls[0]?.[0] as () => void;

function dispatch(msg: unknown): Promise<MsgResult> {
  return new Promise((resolve) => {
    const kept = onMessage(msg as Msg, {}, resolve);
    // Returning true is what keeps the channel open for the async response.
    expect(kept).toBe(true);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('message router', () => {
  it('test_router_given_resolve_expect_resolve_result', async () => {
    api.resolveWord.mockResolvedValue({ query: 'sjø', candidates: [] });

    await expect(
      dispatch({ kind: MSG_KIND.RESOLVE, word: 'sjø' }),
    ).resolves.toEqual({
      ok: true,
      kind: MSG_RESULT_KIND.RESOLVE,
      data: { query: 'sjø', candidates: [] },
    });
  });

  it('test_router_given_search_expect_suggestion_labels', async () => {
    api.searchSuggestions.mockResolvedValue(['sjø']);

    await expect(
      dispatch({ kind: MSG_KIND.SEARCH, query: 'sj' }),
    ).resolves.toEqual({
      ok: true,
      kind: MSG_RESULT_KIND.SUGGESTIONS,
      data: ['sjø'],
    });
  });

  it('test_router_given_detail_with_uuid_expect_detail_result', async () => {
    const data = {
      lemma_uuid: UUID,
      word: 'mote',
      pos: 'verb',
      definitions: [],
    };
    api.getLemmaDefinitions.mockResolvedValue(data);

    await expect(
      dispatch({ kind: MSG_KIND.DETAIL, lemma_uuid: UUID }),
    ).resolves.toEqual({
      ok: true,
      kind: MSG_RESULT_KIND.DETAIL,
      data,
    });
    expect(api.getLemmaDefinitions).toHaveBeenCalledWith(UUID);
  });

  it('test_router_given_add_with_uuid_expect_added', async () => {
    api.addToDeck.mockResolvedValue(undefined);

    await expect(
      dispatch({ kind: MSG_KIND.ADD, lemma_uuid: UUID }),
    ).resolves.toEqual({
      ok: true,
      kind: MSG_RESULT_KIND.ADDED,
    });
    expect(api.addToDeck).toHaveBeenCalledWith(UUID);
  });

  it('test_router_given_add_with_context_expect_context_forwarded', async () => {
    const context = {
      source_sentence: 'Jeg lærer norsk.',
      source_title: 'Lesson',
    };
    api.addToDeck.mockResolvedValue(undefined);

    await expect(
      dispatch({ kind: MSG_KIND.ADD, lemma_uuid: UUID, context }),
    ).resolves.toEqual({ ok: true, kind: MSG_RESULT_KIND.ADDED });
    expect(api.addToDeck).toHaveBeenCalledWith(UUID, context);
  });

  it('test_router_given_know_with_uuid_expect_known', async () => {
    api.markLemmaKnown.mockResolvedValue(undefined);

    await expect(
      dispatch({ kind: MSG_KIND.KNOW, lemma_uuid: UUID }),
    ).resolves.toEqual({ ok: true, kind: MSG_RESULT_KIND.KNOWN });
    expect(api.markLemmaKnown).toHaveBeenCalledWith(UUID);
  });

  it('test_router_given_import_page_expect_imported', async () => {
    api.importPage.mockResolvedValue(undefined);

    await expect(
      dispatch({
        kind: MSG_KIND.IMPORT_PAGE,
        title: 'A',
        source_url: 'https://nrk.no/a',
        text: 'tekst',
      }),
    ).resolves.toEqual({ ok: true, kind: MSG_RESULT_KIND.IMPORTED });
  });

  it('test_router_given_translation_expect_translated_result', async () => {
    const data = {
      source_text: 'Jeg lærer norsk.',
      translated_text: 'I am learning Norwegian.',
      source_language: 'no',
      target_language: 'en',
    };
    api.translateSelection.mockResolvedValue(data);

    await expect(
      dispatch({ kind: MSG_KIND.TRANSLATE, text: 'Jeg lærer norsk.' }),
    ).resolves.toEqual({
      ok: true,
      kind: MSG_RESULT_KIND.TRANSLATED,
      data,
    });
    expect(api.translateSelection).toHaveBeenCalledWith('Jeg lærer norsk.');
  });

  it('test_router_given_max_code_points_ending_in_emoji_expect_translation', async () => {
    const text = 'a'.repeat(LEMMA_CONTEXT_MAX_SENTENCE_LENGTH - 1) + '😀';
    const data = {
      source_text: text,
      translated_text: 'Translation',
      source_language: 'no',
      target_language: 'en',
    };
    api.translateSelection.mockResolvedValue(data);

    await expect(dispatch({ kind: MSG_KIND.TRANSLATE, text })).resolves.toEqual(
      {
        ok: true,
        kind: MSG_RESULT_KIND.TRANSLATED,
        data,
      },
    );
    expect(api.translateSelection).toHaveBeenCalledWith(text);
  });

  it('test_router_given_short_translation_expect_rejected_without_api_call', async () => {
    await expect(
      dispatch({ kind: MSG_KIND.TRANSLATE, text: 'a' }),
    ).resolves.toEqual({ ok: false, error: 'unknown' });
    expect(api.translateSelection).not.toHaveBeenCalled();
  });

  it('test_router_given_sign_in_expect_login_opened', async () => {
    openLogin.mockResolvedValue(undefined);

    await expect(dispatch({ kind: MSG_KIND.SIGN_IN })).resolves.toEqual({
      ok: true,
      kind: MSG_RESULT_KIND.SIGNED_IN,
    });
    expect(openLogin).toHaveBeenCalled();
  });

  it.each([
    ['non-string kind', { kind: 42 }],
    ['resolve without word', { kind: MSG_KIND.RESOLVE }],
    ['resolve with empty word', { kind: MSG_KIND.RESOLVE, word: '' }],
    ['search with empty query', { kind: MSG_KIND.SEARCH, query: '' }],
    ['add with non-uuid', { kind: MSG_KIND.ADD, lemma_uuid: 'not-a-uuid' }],
    [
      'import without text',
      { kind: MSG_KIND.IMPORT_PAGE, title: 'A', source_url: 'u' },
    ],
    ['unrecognized kind', { kind: 'nope' }],
  ])(
    'test_router_given_malformed_message_expect_rejected_without_api_call',
    async (_label, msg) => {
      await expect(dispatch(msg)).resolves.toEqual({
        ok: false,
        error: 'unknown',
      });
      expect(api.resolveWord).not.toHaveBeenCalled();
      expect(api.getLemmaDefinitions).not.toHaveBeenCalled();
      expect(api.searchSuggestions).not.toHaveBeenCalled();
      expect(api.addToDeck).not.toHaveBeenCalled();
      expect(api.markLemmaKnown).not.toHaveBeenCalled();
      expect(api.importPage).not.toHaveBeenCalled();
    },
  );

  it('test_router_given_non_api_failure_expect_network_error', async () => {
    api.addToDeck.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(
      dispatch({ kind: MSG_KIND.ADD, lemma_uuid: UUID }),
    ).resolves.toEqual({
      ok: false,
      error: 'network',
    });
  });

  it('test_router_given_api_failure_expect_classified_error', async () => {
    api.addToDeck.mockRejectedValue(new ApiError(401, 'no session'));

    await expect(
      dispatch({ kind: MSG_KIND.ADD, lemma_uuid: UUID }),
    ).resolves.toEqual({
      ok: false,
      error: 'unauthorized',
    });
  });
});

describe('context menu', () => {
  it('test_context_menu_given_word_selection_expect_show_for_command', () => {
    onMenuClick(
      {
        menuItemId: 'flyt-translate',
        selectionText: '  «sjømat,»  ',
      } as chrome.contextMenus.OnClickData,
      { id: 7 } as chrome.tabs.Tab,
    );

    expect(sendTabCommand).toHaveBeenCalledWith(7, {
      kind: 'showFor',
      word: 'sjømat',
    });
  });

  it('test_context_menu_given_single_letter_expect_show_for_command', () => {
    onMenuClick(
      {
        menuItemId: 'flyt-translate',
        selectionText: 'å',
      } as chrome.contextMenus.OnClickData,
      { id: 7 } as chrome.tabs.Tab,
    );

    expect(sendTabCommand).toHaveBeenCalledWith(7, {
      kind: 'showFor',
      word: 'å',
    });
  });

  it('test_context_menu_given_sentence_expect_show_translation_command', () => {
    onMenuClick(
      {
        menuItemId: 'flyt-translate',
        selectionText: '  Jeg leser en bok.  ',
      } as chrome.contextMenus.OnClickData,
      { id: 7 } as chrome.tabs.Tab,
    );

    expect(sendTabCommand).toHaveBeenCalledWith(7, {
      kind: 'showTranslation',
      text: 'Jeg leser en bok.',
    });
  });

  it('test_context_menu_given_import_item_expect_run_import_command', () => {
    onMenuClick(
      { menuItemId: 'flyt-import-page' } as chrome.contextMenus.OnClickData,
      { id: 7 } as chrome.tabs.Tab,
    );

    expect(sendTabCommand).toHaveBeenCalledWith(7, { kind: 'runImport' });
  });

  it('test_context_menu_given_punctuation_only_expect_no_command', () => {
    onMenuClick(
      {
        menuItemId: 'flyt-translate',
        selectionText: '…?!',
      } as chrome.contextMenus.OnClickData,
      { id: 7 } as chrome.tabs.Tab,
    );

    expect(sendTabCommand).not.toHaveBeenCalled();
  });

  it('test_toolbar_given_supported_tab_expect_run_import_command', () => {
    onActionClick({ id: 9 } as chrome.tabs.Tab);

    expect(sendTabCommand).toHaveBeenCalledWith(9, { kind: 'runImport' });
  });

  it('test_context_menu_given_no_tab_id_expect_no_command', () => {
    onMenuClick(
      { menuItemId: 'flyt-import-page' } as chrome.contextMenus.OnClickData,
      undefined,
    );

    expect(sendTabCommand).not.toHaveBeenCalled();
  });
});

describe('installation', () => {
  it('test_context_menus_given_install_expect_both_menu_items_registered', () => {
    onInstalled();

    const ids = vi
      .mocked(chrome.contextMenus.create)
      .mock.calls.map((call) => call[0].id);
    expect(ids).toEqual(['flyt-translate', 'flyt-import-page']);
    expect(vi.mocked(chrome.contextMenus.create).mock.calls).toEqual([
      [
        expect.objectContaining({
          id: 'flyt-translate',
          contexts: ['selection'],
        }),
      ],
      [
        expect.objectContaining({
          id: 'flyt-import-page',
          contexts: ['page'],
        }),
      ],
    ]);
  });
});
