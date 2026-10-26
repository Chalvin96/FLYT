import type { LemmaContext, MsgResult } from '../lib/messages';
import type { ResolveResponse } from '../lib/resolve-types';
import { hidePopup, openPopup } from './overlay';
import type { PopupFailure } from './buildPopupError';

export type PopupHandle = {
  showLoading(word: string, rect: DOMRect, context?: LemmaContext): void;
  showResult(res: ResolveResponse, rect: DOMRect, context?: LemmaContext): void;
  showSignIn(rect: DOMRect): void;
  showError(
    rect: DOMRect,
    failure?: PopupFailure,
    word?: string,
    context?: LemmaContext,
  ): void;
  showSelection(selection: LemmaContext, rect: DOMRect, text?: string): void;
  hide(): void;
};

export function mountPopup(
  onImportPage: () => Promise<MsgResult>,
): PopupHandle {
  return {
    showLoading(word, rect, context) {
      openPopup({ kind: 'loading', word, context }, rect, onImportPage);
    },
    showResult(res, rect, context) {
      openPopup({ kind: 'result', res, context }, rect, onImportPage);
    },
    showSignIn(rect) {
      openPopup({ kind: 'signIn' }, rect, onImportPage);
    },
    showError(rect, failure = { ok: false, error: 'unknown' }, word, context) {
      openPopup(
        {
          kind: 'error',
          error: failure.error,
          message: failure.message,
          word,
          context,
        },
        rect,
        onImportPage,
      );
    },
    showSelection(selection, rect, text) {
      openPopup({ kind: 'selection', selection, text }, rect, onImportPage);
    },
    hide: hidePopup,
  };
}
