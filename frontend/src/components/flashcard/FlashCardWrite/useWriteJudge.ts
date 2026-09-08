import { useCallback, useEffect, useRef, useState } from 'react';

import type { WriteJudgement } from '@/types/lesson-contracts';

import { withOperationTimeout } from '../operationRequest';
import type { WriteJudgeFn } from '../operationTypes';
import {
  buildWriteValidationMessage,
  isWriteValidationError,
  type WritePhase,
} from './writeView';

/**
 * Drives the write-judgement lifecycle: composing → pending → result,
 * with an `unavailable` escape when the judge service cannot be reached
 * and an inline validation path for 422 responses. The attempt ref
 * invalidates in-flight judgements after unmount or a user edit.
 */
export function useWriteJudge({
  initialPhase = 'composing',
  initialJudgement = null,
  judgeWrite,
  response,
}: {
  initialPhase?: WritePhase;
  initialJudgement?: WriteJudgement | null;
  judgeWrite?: WriteJudgeFn;
  response: string;
}) {
  const [phase, setPhase] = useState<WritePhase>(initialPhase);
  const [judgement, setJudgement] = useState<WriteJudgement | null>(
    initialJudgement,
  );
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const judgeAttemptRef = useRef(0);

  useEffect(
    () => () => {
      judgeAttemptRef.current += 1;
    },
    [],
  );

  /** User edited the response: drop any stale verdict or validation error. */
  const resetToComposing = useCallback(() => {
    judgeAttemptRef.current += 1;
    setPhase('composing');
    setJudgement(null);
    setValidationMessage(null);
  }, []);

  const check = useCallback(() => {
    setJudgement(null);
    setValidationMessage(null);
    if (!judgeWrite) {
      setPhase('unavailable');
      return;
    }
    const attempt = judgeAttemptRef.current + 1;
    judgeAttemptRef.current = attempt;
    setPhase('pending');
    void withOperationTimeout(
      Promise.resolve().then(() => judgeWrite(response)),
    )
      .then((result) => {
        if (attempt !== judgeAttemptRef.current) return;
        setJudgement(result);
        setPhase('result');
      })
      .catch((error: unknown) => {
        if (attempt !== judgeAttemptRef.current) return;
        if (isWriteValidationError(error)) {
          setValidationMessage(buildWriteValidationMessage(error));
          setPhase('composing');
          return;
        }
        setPhase('unavailable');
      });
  }, [judgeWrite, response]);

  return { check, judgement, phase, resetToComposing, validationMessage };
}
