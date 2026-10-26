import type { ReactNode } from 'react';

import type { AttemptPhase } from '@/hooks/flashcard/useExerciseAttempt/useExerciseAttempt';
import type { OperationResult } from '@/lib/operationResult';
import type { Spans } from '@/types/lesson-contracts';

import type { BannerVerdict, StatusVerdict } from './answerVerdict';

export type ExerciseAttemptView =
  | { kind: 'single'; result: OperationResult | null }
  | {
      kind: 'retry';
      phase: AttemptPhase;
      result: OperationResult | null;
      shakeKey: number;
      canReveal: boolean;
      onReveal: () => void;
    };

export type FooterView =
  | { kind: 'pending'; label: string }
  | { kind: 'continue'; disabled: boolean; onContinue?: () => void }
  | { kind: 'check'; disabled: boolean; onCheck: () => void }
  | {
      kind: 'retryCheck';
      disabled: boolean;
      canReveal: boolean;
      onCheck: () => void;
      onReveal: () => void;
    };

interface FooterViewInput {
  attempt: ExerciseAttemptView;
  canCheck: boolean;
  isSubmitting?: boolean;
  onCheck: () => void;
  onContinue?: () => void;
  pending: boolean;
  pendingLabel: string;
}

export function buildFooterView(input: FooterViewInput): FooterView {
  const {
    attempt,
    canCheck,
    isSubmitting,
    onCheck,
    onContinue,
    pending,
    pendingLabel,
  } = input;

  if (pending) {
    return { kind: 'pending', label: pendingLabel };
  }

  if (attempt.kind === 'single') {
    if (attempt.result) {
      return {
        kind: 'continue',
        disabled: Boolean(isSubmitting) || !onContinue,
        onContinue,
      };
    }
    return {
      kind: 'check',
      disabled: !canCheck || Boolean(isSubmitting),
      onCheck,
    };
  }

  if (isTerminal(attempt)) {
    return {
      kind: 'continue',
      disabled: Boolean(isSubmitting) || !onContinue,
      onContinue,
    };
  }

  return {
    kind: 'retryCheck',
    disabled: !canCheck || Boolean(isSubmitting),
    canReveal: attempt.canReveal,
    onCheck,
    onReveal: attempt.onReveal,
  };
}

function isTerminal(attempt: ExerciseAttemptView): boolean {
  return (
    attempt.kind === 'retry' &&
    (attempt.phase === 'solved' || attempt.phase === 'revealed')
  );
}

function footerStatus(
  result: OperationResult | null,
  canCheck: boolean,
  statusHint: string | undefined,
  attempt: ExerciseAttemptView,
  ownsResultFeedback: boolean,
) {
  if (result) {
    if (ownsResultFeedback && statusHint) return statusHint;
    return result.correct ? 'Nice work' : 'Review the answer';
  }
  if (canCheck) return 'Ready to check';
  if (attempt.kind === 'retry' && attempt.phase === 'wrong') {
    return 'Adjust your answer to try again.';
  }
  return statusHint ?? 'Select an answer';
}

interface BannerViewInput {
  attempt: ExerciseAttemptView;
  effectiveResult: OperationResult | null;
  ownsResultFeedback: boolean;
}

function buildBannerVerdict({
  attempt,
  effectiveResult,
  ownsResultFeedback,
}: BannerViewInput): BannerVerdict | null {
  if (attempt.kind === 'retry') {
    if (attempt.phase === 'wrong') return 'wrong-flash';
    if (attempt.phase === 'revealed' && !ownsResultFeedback) return 'revealed';
    if (attempt.phase === 'solved' && !ownsResultFeedback) return 'correct';
    return null;
  }
  if (ownsResultFeedback || !effectiveResult) {
    return null;
  }
  return effectiveResult.correct ? 'correct' : 'incorrect';
}

function buildStatusVerdict(
  effectiveResult: OperationResult | null,
  bannerVerdict: BannerVerdict | null,
  canCheck: boolean,
): StatusVerdict {
  if (effectiveResult) {
    return effectiveResult.correct ? 'correct' : 'incorrect';
  }
  if (bannerVerdict === 'wrong-flash' && !canCheck) {
    return 'incorrect';
  }
  return 'idle';
}

export interface OperationShellView {
  showContinue: boolean;
  bannerVerdict: BannerVerdict | null;
  hasBanner: boolean;
  status: string;
  statusVerdict: StatusVerdict;
  ariaLive: 'polite' | undefined;
  resultHint: ReactNode;
  showExplanation: boolean;
}

interface ShellViewInput {
  attempt: ExerciseAttemptView;
  canCheck: boolean;
  ownsResultFeedback: boolean;
  pendingLabel: string;
  pending: boolean;
  statusHint: string | undefined;
  wrongHint: ReactNode;
  explanation: Spans | null;
}

export function buildOperationShellView(
  input: ShellViewInput,
): OperationShellView {
  const {
    attempt,
    canCheck,
    explanation,
    ownsResultFeedback,
    pending,
    pendingLabel,
    statusHint,
    wrongHint,
  } = input;

  const effectiveResult =
    attempt.kind === 'retry' && !isTerminal(attempt) ? null : attempt.result;

  const bannerVerdict = buildBannerVerdict({
    attempt,
    effectiveResult,
    ownsResultFeedback,
  });
  const hasBanner = bannerVerdict !== null;

  return {
    showContinue:
      attempt.kind === 'retry' ? isTerminal(attempt) : effectiveResult !== null,
    bannerVerdict,
    hasBanner,
    status: pending
      ? pendingLabel
      : footerStatus(
          effectiveResult,
          canCheck,
          statusHint,
          attempt,
          ownsResultFeedback,
        ),
    statusVerdict: buildStatusVerdict(effectiveResult, bannerVerdict, canCheck),
    ariaLive: hasBanner ? undefined : 'polite',
    resultHint:
      attempt.kind === 'single' && effectiveResult && !effectiveResult.correct
        ? wrongHint
        : null,
    showExplanation: hasVisibleExplanation(
      explanation,
      bannerVerdict,
      attempt,
      effectiveResult,
    ),
  };
}

function hasVisibleExplanation(
  explanation: Spans | null,
  bannerVerdict: BannerVerdict | null,
  attempt: ExerciseAttemptView,
  effectiveResult: OperationResult | null,
): boolean {
  if (!explanation) {
    return false;
  }
  if (bannerVerdict === 'correct' || bannerVerdict === 'revealed') {
    return true;
  }
  return attempt.kind === 'single' && effectiveResult !== null;
}
