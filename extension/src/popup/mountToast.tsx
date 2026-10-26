import type { ImportActionStatus } from '../lib/importMessage';
import { claimToast, dismissToast, showToast } from './overlay';

export type ToastHandle = {
  setStatus(status: ImportActionStatus): void;
  dismiss(): void;
};

export function mountImportToast(importsUrl: string): ToastHandle {
  const generation = claimToast(importsUrl);
  return {
    setStatus(status) {
      showToast(generation, status);
    },
    dismiss() {
      dismissToast(generation);
    },
  };
}
