import { useState } from "react";
import { Button } from "@flyt/ui";

import { importErrorMessage, type ImportActionStatus } from "../lib/importMessage";
import { MSG_KIND, MSG_RESULT_KIND, sendMessage, type MsgResult } from "../lib/messages";

type ImportStatus = ImportActionStatus | { kind: "idle" };
const APP_ORIGIN = (import.meta.env.VITE_APP_ORIGIN ?? "http://localhost:5173").replace(/\/$/, "");
const IMPORTS_URL = APP_ORIGIN + "/reading/imports";

export function SignInButton({ onDone }: { onDone: () => void }) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState(false);
  const signIn = async () => {
    setIsPending(true);
    setError(false);
    try {
      const result = await sendMessage({ kind: MSG_KIND.SIGN_IN });
      if (result.ok && result.kind === MSG_RESULT_KIND.SIGNED_IN) {
        onDone();
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setIsPending(false);
    }
  };
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() => void signIn()}
    >
      {isPending ? "Signing in…" : error ? "Try again" : "Sign in to Flyt"}
    </Button>
  );
}

export function ImportAction({
  onImportPage,
}: {
  onImportPage: () => Promise<MsgResult>;
}) {
  const [status, setStatus] = useState<ImportStatus>({ kind: "idle" });

  const handleImport = async () => {
    setStatus({ kind: "importing" });
    try {
      const result = await onImportPage();
      if (result.ok && result.kind === MSG_RESULT_KIND.IMPORTED) {
        setStatus({ kind: "success" });
      } else {
        setStatus({ kind: "error", message: importErrorMessage(result) });
      }
    } catch {
      setStatus({
        kind: "error",
        message:
          "Could not import this page. Check your connection and try again.",
      });
    }
  };

  return (
    <div className="flyt-import-page">
      {status.kind === "success" ? (
        <div className="flyt-import-success" role="status">
          <p className="flyt-import-success-title">Page saved</p>
          <p className="flyt-import-success-copy">
            We’ll prepare it for reading. You can keep browsing.
          </p>
          <a href={IMPORTS_URL} target="_blank" rel="noopener noreferrer">
            View in Flyt
          </a>
        </div>
      ) : (
        <>
          <Button
            size="sm"
            variant="outline"
            className="flyt-import-btn"
            disabled={status.kind === "importing"}
            onClick={() => void handleImport()}
          >
            {status.kind === "importing"
              ? "Saving this page\u2026"
              : "Import this page"}
          </Button>
          {status.kind === "error" && (
            <p className="flyt-import-error" role="alert">
              {status.message}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function SignInPrompt() {
  const [done, setDone] = useState(false);
  const handleSignIn = async () => {
    await sendMessage({ kind: MSG_KIND.SIGN_IN });
    setDone(true);
  };
  return done ? (
    <p className="flyt-hint">Signed in? Right-click the word again.</p>
  ) : (
    <Button size="sm" variant="outline" onClick={handleSignIn}>
      Sign in to Flyt
    </Button>
  );
}
