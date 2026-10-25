import { useCallback, useState } from 'react';

import type { FinishHandler } from '@/components/flashcard/operationTypes';
import {
  K_RATING_AGAIN,
  K_RATING_EASY,
  K_RATING_GOOD,
  K_RATING_HARD,
} from '@/lib/fsrsRatings';
import {
  gradedOutcome,
  type ExerciseOutcome,
  type OperationResult,
  type Rating,
  type UngradedOutcome,
} from '@/lib/operationResult';

export type AttemptPhase = 'working' | 'wrong' | 'solved' | 'revealed';

function isTerminal(phase: AttemptPhase): boolean {
  return phase === 'solved' || phase === 'revealed';
}

export interface ExerciseAttemptConfig {
  allowRetry: boolean;
  commitGradesAtCompletion?: boolean;
  initialResult?: OperationResult | null;
  onFinished?: FinishHandler<ExerciseOutcome>;
}

export function useExerciseAttempt(config: ExerciseAttemptConfig) {
  const {
    allowRetry,
    commitGradesAtCompletion = false,
    initialResult = null,
    onFinished,
  } = config;
  const [wrongCount, setWrongCount] = useState(0);
  const [phase, setPhase] = useState<AttemptPhase>(
    initialResult ? (initialResult.correct ? 'solved' : 'revealed') : 'working',
  );
  const [result, setResult] = useState<OperationResult | null>(initialResult);
  const [dirty, setDirty] = useState(false);

  const reportRight = useCallback(() => {
    if (isTerminal(phase)) return;
    if (allowRetry) {
      setResult({
        correct: true,
        rating: wrongCount === 0 ? K_RATING_EASY : K_RATING_HARD,
      });
    } else if (commitGradesAtCompletion && wrongCount > 0) {
      setResult({ correct: false, rating: K_RATING_AGAIN });
    } else {
      setResult({ correct: true, rating: K_RATING_EASY });
    }
    setPhase('solved');
  }, [allowRetry, commitGradesAtCompletion, phase, wrongCount]);

  const reportWrong = useCallback(() => {
    if (isTerminal(phase)) return;
    if (!allowRetry && !commitGradesAtCompletion) {
      setResult({ correct: false, rating: K_RATING_AGAIN });
      setPhase('revealed');
      return;
    }
    setWrongCount((current) => current + 1);
    setDirty(false);
    setPhase('wrong');
  }, [allowRetry, commitGradesAtCompletion, phase]);

  const check = useCallback(
    (correct: boolean) => {
      if (correct) reportRight();
      else reportWrong();
    },
    [reportRight, reportWrong],
  );

  const reveal = useCallback(
    (fraction: number) => {
      if (!allowRetry || isTerminal(phase)) return;
      setResult({
        correct: false,
        rating: fraction >= 0.5 ? K_RATING_HARD : K_RATING_AGAIN,
      });
      setPhase('revealed');
    },
    [allowRetry, phase],
  );

  const reportRating = useCallback((rating: Rating): OperationResult => {
    const ratedResult = { correct: rating >= K_RATING_GOOD, rating };
    setResult(ratedResult);
    setPhase(ratedResult.correct ? 'solved' : 'revealed');
    return ratedResult;
  }, []);

  const reportVerdict = useCallback((correct: boolean) => {
    setResult({ correct });
    setPhase(correct ? 'solved' : 'revealed');
  }, []);

  const reset = useCallback(() => {
    setWrongCount(0);
    setPhase('working');
    setResult(null);
    setDirty(false);
  }, []);

  const emitOutcome = useCallback(
    (outcome: ExerciseOutcome) => onFinished?.(outcome),
    [onFinished],
  );

  const finish = useCallback(() => {
    if (!result) return false;
    return emitOutcome(gradedOutcome(result));
  }, [emitOutcome, result]);

  const finishRating = useCallback(
    (rating: Rating) => emitOutcome(gradedOutcome(reportRating(rating))),
    [emitOutcome, reportRating],
  );

  const finishUngraded = useCallback(
    (outcome: UngradedOutcome['outcome']) =>
      emitOutcome({ kind: 'ungraded', outcome }),
    [emitOutcome],
  );

  const markDirty = useCallback(() => setDirty(true), []);

  return {
    wrongCount,
    phase,
    result,
    dirty,
    canReveal: allowRetry && !isTerminal(phase),
    isRevealedOrSolved: isTerminal(phase),
    shakeKey: wrongCount,
    reportRight,
    reportWrong,
    check,
    reveal,
    reportRating,
    reportVerdict,
    reset,
    finish,
    finishRating,
    finishUngraded,
    markDirty,
  };
}
