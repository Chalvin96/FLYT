// Service worker: context menu + message router. No in-memory state (the SW is
// killed/restarted) - lib/auth reads the session JWT fresh from the cookie on each call.

import {
  addToDeck,
  getLemmaDefinitions,
  importPage,
  markLemmaKnown,
  resolveWord,
  searchSuggestions,
  translateSelection,
} from '../lib/api';
import { openLogin } from '../lib/auth';
import { classify } from '../lib/classify';
import {
  LEMMA_CONTEXT_MAX_SENTENCE_LENGTH,
  MSG_KIND,
  MSG_RESULT_KIND,
  TAB_CMD,
  boundLemmaContext,
  sendTabCommand,
  type Msg,
  type MsgResult,
} from '../lib/messages';
import { selectionWord } from '../lib/selectionWord';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'flyt-translate',
      title: 'Translate with Flyt',
      contexts: ['selection'],
    });
    chrome.contextMenus.create({
      id: 'flyt-import-page',
      title: 'Import this page to Flyt',
      contexts: ['page'],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  if (info.menuItemId === 'flyt-translate' && info.selectionText) {
    const word = selectionWord(info.selectionText);
    if (word) {
      sendTabCommand(tab.id, { kind: TAB_CMD.SHOW_FOR, word });
      return;
    }
    const text = boundLemmaContext({
      source_sentence: info.selectionText.trim(),
    }).source_sentence;
    if (Array.from(text).length >= 2 && /\p{L}/u.test(text)) {
      sendTabCommand(tab.id, { kind: TAB_CMD.SHOW_TRANSLATION, text });
    }
  } else if (info.menuItemId === 'flyt-import-page') {
    sendTabCommand(tab.id, { kind: TAB_CMD.RUN_IMPORT });
  }
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.id !== undefined) {
    sendTabCommand(tab.id, { kind: TAB_CMD.RUN_IMPORT });
  }
});

chrome.runtime.onMessage.addListener((msg: Msg, _sender, sendResponse) => {
  (async (): Promise<MsgResult> => {
    try {
      // Content scripts are untrusted input - validate shape before dispatching.
      const m = msg as {
        kind?: unknown;
        word?: unknown;
        lemma_uuid?: unknown;
        query?: unknown;
        title?: unknown;
        source_url?: unknown;
        text?: unknown;
        context?: unknown;
      };
      if (typeof m.kind !== 'string') return { ok: false, error: 'unknown' };
      if (
        m.kind === MSG_KIND.RESOLVE &&
        !(typeof m.word === 'string' && m.word.length > 0)
      ) {
        return { ok: false, error: 'unknown' };
      }
      if (
        m.kind === MSG_KIND.DETAIL &&
        !(
          typeof m.lemma_uuid === 'string' &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            m.lemma_uuid,
          )
        )
      ) {
        return { ok: false, error: 'unknown' };
      }
      if (
        m.kind === MSG_KIND.SEARCH &&
        !(typeof m.query === 'string' && m.query.length > 0)
      ) {
        return { ok: false, error: 'unknown' };
      }
      if (
        m.kind === MSG_KIND.ADD &&
        !(
          typeof m.lemma_uuid === 'string' &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            m.lemma_uuid,
          )
        )
      ) {
        return { ok: false, error: 'unknown' };
      }
      if (m.kind === MSG_KIND.ADD && m.context !== undefined) {
        const context = m.context as {
          source_sentence?: unknown;
          source_title?: unknown;
        };
        if (
          typeof context !== 'object' ||
          context === null ||
          typeof context.source_sentence !== 'string' ||
          context.source_sentence.trim().length === 0 ||
          (context.source_title !== undefined &&
            typeof context.source_title !== 'string')
        ) {
          return { ok: false, error: 'unknown' };
        }
      }
      if (
        m.kind === MSG_KIND.KNOW &&
        !(
          typeof m.lemma_uuid === 'string' &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            m.lemma_uuid,
          )
        )
      ) {
        return { ok: false, error: 'unknown' };
      }
      if (
        m.kind === MSG_KIND.IMPORT_PAGE &&
        !(
          typeof m.title === 'string' &&
          typeof m.source_url === 'string' &&
          typeof m.text === 'string'
        )
      ) {
        return { ok: false, error: 'unknown' };
      }
      if (
        m.kind === MSG_KIND.TRANSLATE &&
        !(
          typeof m.text === 'string' &&
          Array.from(m.text.trim()).length >= 2 &&
          Array.from(m.text).length <= LEMMA_CONTEXT_MAX_SENTENCE_LENGTH
        )
      ) {
        return { ok: false, error: 'unknown' };
      }
      switch (msg.kind) {
        case MSG_KIND.RESOLVE:
          return {
            ok: true,
            kind: MSG_RESULT_KIND.RESOLVE,
            data: await resolveWord(msg.word),
          };
        case MSG_KIND.DETAIL:
          return {
            ok: true,
            kind: MSG_RESULT_KIND.DETAIL,
            data: await getLemmaDefinitions(msg.lemma_uuid),
          };
        case MSG_KIND.SEARCH:
          return {
            ok: true,
            kind: MSG_RESULT_KIND.SUGGESTIONS,
            data: await searchSuggestions(msg.query),
          };
        case MSG_KIND.ADD:
          if (msg.context) {
            await addToDeck(msg.lemma_uuid, msg.context);
          } else {
            await addToDeck(msg.lemma_uuid);
          }
          // 409 treated as success
          return { ok: true, kind: MSG_RESULT_KIND.ADDED };
        case MSG_KIND.KNOW:
          await markLemmaKnown(msg.lemma_uuid);
          return { ok: true, kind: MSG_RESULT_KIND.KNOWN };
        case MSG_KIND.IMPORT_PAGE:
          await importPage({
            title: msg.title,
            source_url: msg.source_url,
            text: msg.text,
          });
          return { ok: true, kind: MSG_RESULT_KIND.IMPORTED };
        case MSG_KIND.TRANSLATE:
          return {
            ok: true,
            kind: MSG_RESULT_KIND.TRANSLATED,
            data: await translateSelection(msg.text),
          };
        case MSG_KIND.SIGN_IN:
          await openLogin(); // opens the app's OAuth in a tab; cookie set on success
          return { ok: true, kind: MSG_RESULT_KIND.SIGNED_IN };
        default:
          return { ok: false, error: 'unknown' };
      }
    } catch (e) {
      return classify(e);
    }
  })().then(sendResponse);
  return true; // keep the message channel open for the async response
});
