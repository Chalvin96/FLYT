import { useEffect, useRef, useState } from "react";

import { MSG_KIND, MSG_RESULT_KIND, sendMessage } from "../lib/messages";
import type { ResolveResponse } from "../lib/resolve-types";
import type { PopupFailure } from "./buildPopupError";

export type TokenIdentity = {
  word: string;
  /** Which repeat of the word was tapped; absent when the lookup started outside the sentence. */
  occurrence?: number;
};

export type WordLookup =
  | { kind: "idle" }
  | {
      kind: "loading" | "notFound" | "resolved";
      token: TokenIdentity;
    }
  | { kind: "error"; token: TokenIdentity; failure: PopupFailure };

export function usePopupWordLookup(
  onResolved: (res: ResolveResponse) => void,
  onNotFound?: (word: string) => void,
) {
  const [wordLookup, setWordLookup] = useState<WordLookup>({ kind: "idle" });
  const resolveRequestRef = useRef(0);
  const aliveRef = useRef(true);
  const onResolvedRef = useRef(onResolved);
  const onNotFoundRef = useRef(onNotFound);

  useEffect(() => {
    onResolvedRef.current = onResolved;
    onNotFoundRef.current = onNotFound;
  });

  useEffect(() => {
    return () => {
      aliveRef.current = false;
      resolveRequestRef.current += 1;
    };
  }, []);

  const resolveWord = async (word: string, occurrence?: number) => {
    const token: TokenIdentity = { word, occurrence };
    const requestId = ++resolveRequestRef.current;
    setWordLookup({ kind: "loading", token });
    try {
      const result = await sendMessage({ kind: MSG_KIND.RESOLVE, word });
      if (requestId !== resolveRequestRef.current) return;
      if (result.ok && result.kind === MSG_RESULT_KIND.RESOLVE) {
        if (result.data.candidates.length > 0) {
          if (aliveRef.current) onResolvedRef.current(result.data);
          setWordLookup({ kind: "resolved", token });
        } else {
          if (aliveRef.current) onNotFoundRef.current?.(word);
          setWordLookup({ kind: "notFound", token });
        }
        return;
      }
      setWordLookup({
        kind: "error",
        token,
        failure: result.ok ? { ok: false, error: "unknown" } : result,
      });
    } catch {
      if (requestId === resolveRequestRef.current) {
        setWordLookup({
          kind: "error",
          token,
          failure: { ok: false, error: "network" },
        });
      }
    }
  };

  const invalidateLookup = () => {
    resolveRequestRef.current += 1;
  };

  const resetLookup = () => {
    setWordLookup({ kind: "idle" });
  };

  return { invalidateLookup, resetLookup, resolveWord, wordLookup };
}
