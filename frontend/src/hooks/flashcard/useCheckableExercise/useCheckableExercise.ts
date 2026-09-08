import { useCallback, useState } from 'react';

import { useExerciseMode } from '@/components/flashcard/useExerciseMode';
import { K_RATING_EASY, K_RATING_HARD } from '@/lib/fsrsRatings';
import { revealRating, type OperationResult } from '@/lib/operationResult';

export type CheckablePhase = 'working' | 'wrong' | 'solved' | 'revealed';

export interface UseCheckableExercise {
  /** Number of wrong checks so far. */
  attempts: number;
  /** Current phase in the no-fail retry state machine. */
  phase: CheckablePhase;
  /**
   * The terminal result passed to `onFinished` on Continue. Stays null until
   * the exercise reaches `solved` or `revealed`.
   */
  result: OperationResult | null;
  /**
   * False after a wrong check; the caller must `markDirty()` (i.e. the
   * learner changed their answer) before Check can fire again.
   */
  dirty: boolean;
  /** True when reveal is allowed (>= 1 wrong check, not terminal). */
  canReveal: boolean;
  /** True once a terminal phase is reached. */
  isRevealedOrSolved: boolean;
  /** Drives the shake animation remount; equals `attempts`. */
  shakeKey: number;
  /**
   * Score the current answer. No-op once terminal. Only `attempts`
   * (not a fraction) drives the check rating, so no fraction is accepted.
   */
  check: (isCorrect: boolean) => void;
  /** Reveal the answer with an auto-judged rating. No-op unless allowed. */
  reveal: (fraction: number) => void;
  /** Record that the learner changed the board after a wrong check. */
  markDirty: () => void;
}

function isTerminal(phase: CheckablePhase): boolean {
  return phase === 'solved' || phase === 'revealed';
}

/**
 * Shared state machine for Match / Categorize / Build review exercises.
 *
 * Rating model (single source of truth):
 * - Solved on first check (0 wrong)     → Easy (4).
 * - Solved after >= 1 wrong check       → Hard (2).
 * - Reveal with partial-correct >= 0.5  → Hard (2); else → Again (1).
 *
 * Commit mode (allowRetry === false, i.e. REVIEW surface):
 * Collapses to a single shot — a wrong check goes straight to a terminal
 * phase with `result = { correct: false }` (no rating override), so
 * `ratingFromResult` yields a binary 4/1. No retry, no Reveal.
 */
export function useCheckableExercise(): UseCheckableExercise {
  const { allowRetry } = useExerciseMode();
  const [attempts, setAttempts] = useState(0);
  const [phase, setPhase] = useState<CheckablePhase>('working');
  const [result, setResult] = useState<OperationResult | null>(null);
  const [dirty, setDirty] = useState(false);

  const check = useCallback(
    (isCorrect: boolean) => {
      if (isTerminal(phase)) {
        return;
      }
      if (!allowRetry) {
        // Commit mode: one-shot, binary result with NO rating override so
        // ratingFromResult yields 4 (correct) or 1 (wrong). A wrong answer
        // lands in 'revealed' (terminal) — NOT the 'wrong' retry phase.
        setResult({ correct: isCorrect });
        setPhase(isCorrect ? 'solved' : 'revealed');
        return;
      }
      if (isCorrect) {
        setResult({
          correct: true,
          rating: attempts === 0 ? K_RATING_EASY : K_RATING_HARD,
        });
        setPhase('solved');
        return;
      }
      setAttempts((current) => current + 1);
      setDirty(false);
      setPhase('wrong');
    },
    // `attempts` drives the rating (3 vs 2); `phase` gates the no-op.
    [allowRetry, attempts, phase],
  );

  const reveal = useCallback(
    (fraction: number) => {
      if (!allowRetry || isTerminal(phase) || attempts < 1) {
        return;
      }
      setResult({ correct: false, rating: revealRating(fraction) });
      setPhase('revealed');
    },
    [allowRetry, attempts, phase],
  );

  const markDirty = useCallback(() => {
    setDirty(true);
  }, []);

  return {
    attempts,
    phase,
    result,
    dirty,
    canReveal: allowRetry && attempts >= 1 && !isTerminal(phase),
    isRevealedOrSolved: isTerminal(phase),
    shakeKey: attempts,
    check,
    reveal,
    markDirty,
  };
}
