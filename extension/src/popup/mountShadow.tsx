import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import type { ResolveResponse } from '../lib/resolve-types';
import type { MsgResult } from '../lib/messages';
import type { LemmaContext } from '../lib/messages';
import { Popup, type PopupState } from './Popup';
import { createShadowHost } from './shadowHost';

export type PopupHandle = {
  showLoading(word: string, rect: DOMRect, context?: LemmaContext): void;
  showResult(
    res: ResolveResponse,
    rect: DOMRect,
    context?: LemmaContext,
  ): void;
  showSignIn(rect: DOMRect): void;
  showError(rect: DOMRect): void;
  showSelection(selection: LemmaContext, rect: DOMRect, text?: string): void;
  hide(): void;
};

export function mountPopup(
  onImportPage: () => Promise<MsgResult>,
): PopupHandle {
  const { container, reactHost } = createShadowHost();
  container.style.cssText =
    'position:absolute;z-index:2147483647;top:0;left:0;display:none;';

  const root = createRoot(reactHost);

  let currentState: PopupState = { kind: 'hidden' };
  // Incremented only when the popup re-opens from hidden. Passed to Popup as the
  // <ImportAction> key so each fresh open resets the import button, while a
  // same-session loading -> result transition keeps an in-flight import.
  let sessionId = 0;
  let anchorRect: DOMRect | null = null;
  let resizeObserver: ResizeObserver | null = null;

  const ensureMounted = () => {
    if (!container.isConnected) document.body.appendChild(container);
  };

  const render = () => {
    flushSync(() => {
      root.render(
        <Popup
          state={currentState}
          onImportPage={onImportPage}
          onClose={hide}
          sessionId={sessionId}
        />,
      );
    });
  };

  // Start a new session when opening from hidden (not on within-session updates).
  const open = (next: PopupState, rect: DOMRect) => {
    if (currentState.kind === 'hidden') sessionId += 1;
    currentState = next;
    place(rect);
  };

  const positionPanel = (rect: DOMRect) => {
    const panel = reactHost.firstElementChild as HTMLElement | null;
    const height = panel?.offsetHeight ?? 120;
    const width = panel?.offsetWidth ?? 440;
    const margin = 10;
    const below = rect.bottom + 6 + height <= window.innerHeight - margin;
    const preferredTop = below ? rect.bottom + 6 : rect.top - height - 6;
    const top = Math.max(
      margin,
      Math.min(preferredTop, window.innerHeight - height - margin),
    );
    const left = Math.max(
      margin,
      Math.min(rect.left, window.innerWidth - width - margin),
    );
    container.style.left = `${window.scrollX + left}px`;
    container.style.top = `${window.scrollY + top}px`;
  };

  // Reposition after async translation/detail content changes the panel height.
  const observePanel = () => {
    resizeObserver?.disconnect();
    if (!('ResizeObserver' in window)) return;
    const panel = reactHost.firstElementChild;
    if (!panel) return;
    resizeObserver = new ResizeObserver(() => {
      if (anchorRect) positionPanel(anchorRect);
    });
    resizeObserver.observe(panel);
  };

  // Edge-flip and viewport clamp around the current selection.
  const place = (rect: DOMRect) => {
    anchorRect = rect;
    ensureMounted();
    container.style.display = 'block';
    render();
    observePanel();
    positionPanel(rect);
  };

  const hide = () => {
    currentState = { kind: 'hidden' };
    anchorRect = null;
    resizeObserver?.disconnect();
    container.style.display = 'none';
    render();
  };

  // Dismiss on Escape / outside click.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hide();
  });
  document.addEventListener(
    'pointerdown',
    (e) => {
      // Shadow-DOM retargeting: clicks inside the popup appear as `container` at document
      // level, so this only fires for genuine outside clicks.
      if (e.target !== container) hide();
    },
    true,
  );

  return {
    showLoading(word, rect, context) {
      open({ kind: 'loading', word, context }, rect);
    },
    showResult(res, rect, context) {
      open({ kind: 'result', res, context }, rect);
    },
    showSignIn(rect) {
      open({ kind: 'signIn' }, rect);
    },
    showError(rect) {
      open({ kind: 'error' }, rect);
    },
    showSelection(selection, rect, text) {
      open({ kind: 'selection', selection, text }, rect);
    },
    hide,
  };
}
