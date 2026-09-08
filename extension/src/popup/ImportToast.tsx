import type { ImportActionStatus } from "../lib/importMessage";

// Non-modal status toast for a context-menu "Import this page". Unlike the
// lookup popup this is passive (role=status, no focus trap): the menu click is
// the trigger, so there is no import button — only importing / success / error,
// plus an explicit dismiss (dismissing on any click would eat the success link).
export function ImportToast({
  status,
  importsUrl,
  onClose,
}: {
  status: ImportActionStatus;
  importsUrl: string;
  onClose: () => void;
}) {
  return (
    <div className="flyt-popup" role="status" aria-live="polite">
      <div className="flyt-logo-bar">
        <div className="flyt-logo-box">F</div>
        <span className="flyt-wordmark">Flyt</span>
        <button
          type="button"
          className="flyt-toast-close"
          aria-label="Dismiss"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="flyt-import-page">
        {status.kind === "importing" && (
          <p className="flyt-toast-msg">Saving this page…</p>
        )}
        {status.kind === "success" && (
          <div className="flyt-import-success">
            <p className="flyt-import-success-title">Page saved</p>
            <p className="flyt-import-success-copy">
              We’ll prepare it for reading. You can keep browsing.
            </p>
            <a href={importsUrl} target="_blank" rel="noopener noreferrer">
              View in Flyt
            </a>
          </div>
        )}
        {status.kind === "error" && (
          <p className="flyt-import-error">{status.message}</p>
        )}
      </div>
    </div>
  );
}
