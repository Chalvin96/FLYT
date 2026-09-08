import { useEffect, useRef, useState } from "react";

import { MSG_KIND, MSG_RESULT_KIND, sendMessage } from "../lib/messages";
import type { ResolveResponse } from "../lib/resolve-types";

export type WordLookup =
  { kind: "idle" } | { kind: "loading" | "error" | "notFound"; word: string };

/**
 * Word-level lookup inside a sentence selection: runs resolve requests,
 * invalidates stale responses via a request counter, and stops applying
 * results after unmount.
 */
export function usePopupWordLookup(onResolved: (res: ResolveResponse) => void) {
  const [wordLookup, setWordLookup] = useState<WordLookup>({ kind: "idle" });
  const resolveRequestRef = useRef(0);
  const aliveRef = useRef(true);
  const onResolvedRef = useRef(onResolved);

  useEffect(() => {
    onResolvedRef.current = onResolved;
  });

  useEffect(() => {
    return () => {
      aliveRef.current = false;
      resolveRequestRef.current += 1;
    };
  }, []);

  const resolveWord = async (word: string) => {
    const requestId = ++resolveRequestRef.current;
    setWordLookup({ kind: "loading", word });
    try {
      const result = await sendMessage({ kind: MSG_KIND.RESOLVE, word });
      if (requestId !== resolveRequestRef.current) return;
      if (result.ok && result.kind === MSG_RESULT_KIND.RESOLVE) {
        if (result.data.candidates.length > 0) {
          if (aliveRef.current) onResolvedRef.current(result.data);
          setWordLookup({ kind: "idle" });
        } else {
          setWordLookup({ kind: "notFound", word });
        }
        return;
      }
      setWordLookup({ kind: "error", word });
    } catch {
      if (requestId === resolveRequestRef.current) {
        setWordLookup({ kind: "error", word });
      }
    }
  };

  /** Cancels any in-flight lookup (search reset / back navigation). */
  const invalidateLookup = () => {
    resolveRequestRef.current += 1;
  };

  const resetLookup = () => {
    setWordLookup({ kind: "idle" });
  };

  return { invalidateLookup, resetLookup, resolveWord, wordLookup };
}
