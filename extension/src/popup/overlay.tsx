import { createRoot, type Root } from 'react-dom/client';

import { createShadowSurface, type ShadowSurface } from '@flyt/ui';

import type { ImportActionStatus } from '../lib/importMessage';
import type { MsgResult } from '../lib/messages';
import { shadowCss, shadowMode } from '../lib/shadowSheet';
import type { PopupState } from './Popup';
import { OverlayView } from './overlayView';

type OverlayState = {
  popup: {
    state: PopupState;
    anchorRect: DOMRect | null;
    sessionId: number;
  };
  toast: {
    generation: number;
    importsUrl: string;
    status: ImportActionStatus | { kind: 'idle' };
  };
  icon: {
    position: { top: string; left: string } | null;
    activate: () => void;
  };
};

const idleOverlay = (toastGeneration: number): OverlayState => ({
  popup: {
    state: { kind: 'hidden' },
    anchorRect: null,
    sessionId: 0,
  },
  toast: {
    generation: toastGeneration,
    importsUrl: '',
    status: { kind: 'idle' },
  },
  icon: { position: null, activate: () => {} },
});

let overlay = idleOverlay(0);
let surface: ShadowSurface | null = null;
let root: Root | null = null;
let importPage: (() => Promise<MsgResult>) | null = null;
const listeners = new Set<() => void>();

export function popupImportPage(): Promise<MsgResult> {
  if (!importPage)
    throw new Error('the popup registers its import action before it opens');
  return importPage();
}

export function getOverlaySnapshot(): OverlayState {
  return overlay;
}

export function subscribeOverlay(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const setOverlay = (next: OverlayState) => {
  overlay = next;
  listeners.forEach((listener) => listener());
};

const ensureAttached = () => {
  if (!surface) {
    surface = createShadowSurface(shadowCss, { mode: shadowMode() });
    surface.container.style.cssText =
      'position:absolute;z-index:2147483647;top:0;left:0;';
    root = createRoot(surface.reactHost);
    root.render(<OverlayView portal={surface.PortalSurface} />);
  }
  if (!surface.container.isConnected) {
    document.body.appendChild(surface.container);
  }
};

export function openPopup(
  next: PopupState,
  rect: DOMRect,
  onImportPage: () => Promise<MsgResult>,
): void {
  importPage = onImportPage;
  const fromHidden = overlay.popup.state.kind === 'hidden';
  setOverlay({
    ...overlay,
    popup: {
      state: next,
      anchorRect: rect,
      sessionId: fromHidden
        ? overlay.popup.sessionId + 1
        : overlay.popup.sessionId,
    },
  });
  ensureAttached();
}

export function hidePopup(): void {
  setOverlay({
    ...overlay,
    popup: { ...overlay.popup, state: { kind: 'hidden' }, anchorRect: null },
  });
}

export function claimToast(importsUrl: string): number {
  const generation = overlay.toast.generation + 1;
  setOverlay({
    ...overlay,
    toast: { generation, importsUrl, status: { kind: 'idle' } },
  });
  return generation;
}

export function showToast(
  generation: number,
  status: ImportActionStatus,
): void {
  if (generation !== overlay.toast.generation) return;
  setOverlay({ ...overlay, toast: { ...overlay.toast, status } });
  ensureAttached();
}

export function dismissToast(generation: number): void {
  if (generation !== overlay.toast.generation) return;
  setOverlay({
    ...overlay,
    toast: {
      ...overlay.toast,
      generation: generation + 1,
      status: { kind: 'idle' },
    },
  });
}

export function showIcon(
  position: { top: string; left: string },
  onActivate: () => void,
): void {
  setOverlay({ ...overlay, icon: { position, activate: onActivate } });
  ensureAttached();
}

export function hideIcon(): void {
  setOverlay({ ...overlay, icon: { ...overlay.icon, position: null } });
}

export function resetOverlay(): void {
  root?.unmount();
  root = null;
  surface?.container.remove();
  surface = null;
  importPage = null;
  overlay = idleOverlay(overlay.toast.generation + 1);
}
