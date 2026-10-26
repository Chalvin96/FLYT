import { useReducedMotion } from 'motion/react';
import { useEffect, useRef, type ReactNode } from 'react';

import type { Exercise } from '@/types/lesson-contracts';

import {
  buildFooterView,
  buildOperationShellView,
  type ExerciseAttemptView,
} from './operationShellView';

type OperationShellStateInput = {
  attempt: ExerciseAttemptView;
  exercise: Exercise;
  canCheck: boolean;
  isSubmitting?: boolean;
  ownsResultFeedback?: boolean;
  pending: boolean;
  pendingLabel: string;
  statusHint?: string;
  wrongHint?: ReactNode;
  onCheck: () => void;
  onContinue?: () => void;
};

export function useOperationShellState({
  attempt,
  exercise,
  canCheck,
  isSubmitting,
  ownsResultFeedback = false,
  pending,
  pendingLabel,
  statusHint,
  wrongHint,
  onCheck,
  onContinue,
}: OperationShellStateInput) {
  const view = buildOperationShellView({
    attempt,
    canCheck,
    explanation: exercise.explanation,
    ownsResultFeedback,
    pending,
    pendingLabel,
    statusHint,
    wrongHint,
  });
  const reducedMotionPreference = useReducedMotion();
  const reducedMotion = Boolean(reducedMotionPreference);
  const continueRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (view.showContinue) {
      continueRef.current?.focus();
    }
  }, [view.showContinue]);

  const footerView = buildFooterView({
    attempt,
    canCheck,
    isSubmitting,
    onCheck,
    onContinue,
    pending,
    pendingLabel,
  });

  return { view, footerView, continueRef, reducedMotion };
}
