// The service worker relays selection lookup/translation and page import here.

import { Readability } from '@mozilla/readability';

import { boundImportTitle } from '../lib/importTitle';
import { importErrorMessage } from '../lib/importMessage';
import {
  MSG_KIND,
  MSG_RESULT_KIND,
  TAB_CMD,
  boundLemmaContext,
  sendMessage,
  type LemmaContext,
} from '../lib/messages';
import type { MsgResult } from '../lib/messages';
import { type PopupHandle, mountPopup } from '../popup/mountShadow';
import { type ToastHandle, mountImportToast } from '../popup/mountToast';
import {
  containingSentence,
  selectionTextOffset,
} from './containingSentence';
import { mountSelectionIcon } from './selectionIcon';
import { watchSelection } from './selectionListener';

const APP_ORIGIN = (
  import.meta.env.VITE_APP_ORIGIN ?? 'http://localhost:5173'
).replace(/\/$/, '');
const IMPORTS_URL = `${APP_ORIGIN}/reading/imports`;
const ERROR_DISMISS_MS = 8000;

let host: PopupHandle | null = null;
let toast: ToastHandle | null = null;

async function importCurrentPage(): Promise<MsgResult> {
  const clonedDocument = document.cloneNode(true) as Document;
  const article = new Readability(clonedDocument).parse();

  return sendMessage({
    kind: MSG_KIND.IMPORT_PAGE,
    title: boundImportTitle(article?.title, document.title),
    source_url: location.href,
    text: article?.textContent ?? '',
  });
}

// Context-menu "Import this page": extract + submit, showing a passive toast.
async function runMenuImport(): Promise<void> {
  toast?.dismiss();
  const current = mountImportToast(IMPORTS_URL);
  toast = current;
  current.setStatus({ kind: 'importing' });

  // Readability.parse() and sendMessage() can throw (e.g. the worker died or the
  // extension context was invalidated); without this the toast would hang on
  // "Importing…" forever and the rejection would be unhandled.
  let res: MsgResult;
  try {
    res = await importCurrentPage();
  } catch {
    res = { ok: false, error: 'network' };
  }

  if (res.ok && res.kind === MSG_RESULT_KIND.IMPORTED) {
    current.setStatus({ kind: 'success' });
  } else {
    current.setStatus({ kind: 'error', message: importErrorMessage(res) });
    window.setTimeout(() => current.dismiss(), ERROR_DISMISS_MS);
  }
}

function contextForSelection(selected: string): LemmaContext {
  const selection = window.getSelection();
  const range =
    selection && selection.rangeCount > 0 && !selection.isCollapsed
      ? selection.getRangeAt(0)
      : undefined;
  const node = range?.startContainer;
  const element =
    node?.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node?.parentElement;
  const container = element?.closest('p, li, blockquote, td, th, figcaption');
  const source = container?.textContent;
  const selectedStart =
    container && range ? selectionTextOffset(container, range) : undefined;
  return boundLemmaContext({
    source_sentence: source
      ? containingSentence(source, selected, selectedStart)
      : selected,
    source_title: document.title,
  });
}

async function trigger(word: string, rect: DOMRect): Promise<void> {
  host ??= mountPopup(importCurrentPage);
  const context = contextForSelection(word);
  host.showLoading(word, rect, context);
  const res = await sendMessage({ kind: MSG_KIND.RESOLVE, word });
  if (res.ok && res.kind === MSG_RESULT_KIND.RESOLVE) {
    if (res.data.candidates.length > 0) host.showResult(res.data, rect, context);
    else host.showSelection(context, rect, word);
  }
  else if (!res.ok && res.error === 'unauthorized') host.showSignIn(rect);
  else host.showError(rect);
}

function triggerSentence(text: string, rect: DOMRect): void {
  host ??= mountPopup(importCurrentPage);
  host.showSelection(
    boundLemmaContext({
      source_sentence: text,
      source_title: document.title,
    }),
    rect,
  );
}

// The icon stays detached until its first show, so mounting here is free.
watchSelection(mountSelectionIcon(), (word, rect) => void trigger(word, rect));

chrome.runtime.onMessage.addListener(
  (
    m: { kind?: string; word?: string; text?: string },
    _sender,
    sendResponse,
  ) => {
    if (m?.kind === TAB_CMD.PING) {
      sendResponse(true);
      return;
    }
    if (m?.kind === TAB_CMD.RUN_IMPORT) {
      void runMenuImport();
      return;
    }
    if (m?.kind === TAB_CMD.SHOW_TRANSLATION && m.text) {
      const selection = window.getSelection();
      const rect =
        selection && selection.rangeCount > 0
          ? selection.getRangeAt(0).getBoundingClientRect()
          : new DOMRect(window.innerWidth / 2, window.innerHeight / 2);
      triggerSentence(m.text, rect);
      return;
    }
    if (m?.kind !== TAB_CMD.SHOW_FOR || !m.word) return;
    const sel = window.getSelection();
    const rect =
      sel && sel.rangeCount > 0 && !sel.isCollapsed
        ? sel.getRangeAt(0).getBoundingClientRect()
        : new DOMRect(window.innerWidth / 2, window.innerHeight / 2);
    void trigger(m.word, rect);
  },
);
