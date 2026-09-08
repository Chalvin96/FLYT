import { createRoot } from 'react-dom/client';

import type { ImportActionStatus } from '../lib/importMessage';
import { ImportToast } from './ImportToast';
import { createShadowHost } from './shadowHost';

export type ToastHandle = {
  setStatus(status: ImportActionStatus): void;
  dismiss(): void;
};

// Mounts a fixed bottom-right import toast in a closed shadow root. The caller
// drives the status and dismisses transient failures.
export function mountImportToast(importsUrl: string): ToastHandle {
  const { container, reactHost } = createShadowHost();
  container.style.cssText =
    'position:fixed;z-index:2147483647;right:16px;bottom:16px;';
  document.body.appendChild(container);

  const root = createRoot(reactHost);
  let done = false;

  const dismiss = () => {
    if (done) return;
    done = true;
    root.unmount();
    container.remove();
  };

  return {
    setStatus(status) {
      if (done) return;
      // Dismiss via the toast's own close button, not an outside pointerdown:
      // a pointerdown listener removes the toast before the success link's
      // click/navigation can fire, so the link would silently do nothing.
      root.render(
        <ImportToast status={status} importsUrl={importsUrl} onClose={dismiss} />,
      );
    },
    dismiss,
  };
}
