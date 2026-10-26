import { useState } from "react";

import { importErrorMessage } from "../lib/importMessage";
import type { PopupFailure } from "./buildPopupError";
import { MSG_RESULT_KIND, type MsgResult } from "../lib/messages";

export type ImportStatus =
  | { kind: "idle" | "importing" | "success" }
  | { kind: "error"; failure: PopupFailure };

export function usePageImport(
  onImportPage: () => Promise<MsgResult>,
  sessionId: number,
) {
  const [current, setCurrent] = useState<{
    sessionId: number;
    status: ImportStatus;
  }>({ sessionId, status: { kind: "idle" } });
  if (current.sessionId !== sessionId) {
    setCurrent({ sessionId, status: { kind: "idle" } });
  }
  const setStatus = (status: ImportStatus) =>
    setCurrent((previous) =>
      previous.sessionId === sessionId ? { sessionId, status } : previous,
    );
  const importPage = async () => {
    setStatus({ kind: "importing" });
    try {
      const result = await onImportPage();
      setStatus(
        result.ok && result.kind === MSG_RESULT_KIND.IMPORTED
          ? { kind: "success" }
          : {
              kind: "error",
              failure: {
                ok: false,
                error: result.ok ? "unknown" : result.error,
                message: importErrorMessage(result),
              },
            },
      );
    } catch {
      setStatus({
        kind: "error",
        failure: {
          ok: false,
          error: "network",
          message:
            "Could not import this page. Check your connection and try again.",
        },
      });
    }
  };
  return { status: current.status, importPage };
}
