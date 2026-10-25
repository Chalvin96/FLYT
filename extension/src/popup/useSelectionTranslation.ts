import { useEffect, useState } from "react";

import { MSG_KIND, MSG_RESULT_KIND, sendMessage } from "../lib/messages";
import type { PopupFailure } from "./buildPopupError";

type TranslationState =
  | { kind: "loading" }
  | { kind: "success"; text: string }
  | { kind: "error"; failure: PopupFailure };

export function useSelectionTranslation(
  text: string,
  onError?: (failure: PopupFailure | null) => void,
) {
  const [attempt, setAttempt] = useState(0);
  const [response, setResponse] = useState<{
    source: string;
    attempt: number;
    state: TranslationState;
  } | null>(null);
  const hasTranslatableText =
    Array.from(text).length >= 2 && /\p{L}/u.test(text);

  useEffect(() => {
    if (!hasTranslatableText) {
      onError?.(null);
      return;
    }
    let cancelled = false;
    const succeed = (translatedText: string) => {
      if (cancelled) return;
      setResponse({
        source: text,
        attempt,
        state: { kind: "success", text: translatedText },
      });
      onError?.(null);
    };
    const fail = (failure: PopupFailure) => {
      if (cancelled) return;
      setResponse({ source: text, attempt, state: { kind: "error", failure } });
      onError?.(failure);
    };
    void sendMessage({ kind: MSG_KIND.TRANSLATE, text })
      .then((result) => {
        if (cancelled) return;
        if (result.ok && result.kind === MSG_RESULT_KIND.TRANSLATED) {
          succeed(result.data.translated_text);
        } else if (
          !result.ok &&
          (result.error === "too-large" || result.error === "invalid-page")
        ) {
          succeed(text);
        } else fail(result.ok ? { ok: false, error: "unknown" } : result);
      })
      .catch(() => fail({ ok: false, error: "network" }));
    return () => {
      cancelled = true;
    };
  }, [text, attempt, onError, hasTranslatableText]);

  const retry = () => {
    onError?.(null);
    setAttempt((current) => current + 1);
  };
  const state: TranslationState = !hasTranslatableText
    ? { kind: "success", text }
    : response?.source === text && response.attempt === attempt
      ? response.state
      : { kind: "loading" };
  return { state, retry };
}
