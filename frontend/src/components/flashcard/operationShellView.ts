import type { ReactNode } from 'react';

import type { CheckablePhase } from '@/hooks/flashcard/useCheckableExercise/useCheckableExercise';
import type { OperationResult } from '@/lib/operationResult';
import type { Spans } from '@/types/lesson-contracts';

/**
 * Re-exported as a type alias so the canonical phase union lives in one
 * place (`useCheckableExercise`) and the hook, the shell, and the shell's
 * view model share it.
 */
export type RetryPhase = CheckablePhase;

export interface RetryConfig {
  /** Current phase of the no-fail retry state machine. */
  phase: RetryPhase;
  /** Increments on every wrong check to retrigger the shake animation. */
  shakeKey: number;
  /** True when Reveal is allowed (>= 1 wrong check, not terminal). */
  canReveal: boolean;
  /** Called when the learner clicks "Reveal answer". */
  onReveal: () => void;
}

/** Which terminal/feedback banner the shell shows. At most one is visible. */
export type BannerKind = 'wrong' | 'revealed' | 'solved' | 'incorrect';

export type StatusTone = 'accent' | 'destructive' | 'muted';

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
  canCheck: boolean;
  effectiveResult: OperationResult | null;
  isSubmitting?: boolean;
  isTerminal: boolean;
  onCheck: () => void;
  onContinue?: () => void;
  pending: boolean;
  pendingLabel: string;
  retry?: RetryConfig;
  retryActive: boolean;
}

export function buildFooterView(input: FooterViewInput): FooterView {
  const {
    canCheck,
    effectiveResult,
    isSubmitting,
    isTerminal,
    onCheck,
    onContinue,
    pending,
    pendingLabel,
    retry,
    retryActive,
  } = input;

  if (pending) {
    return { kind: 'pending', label: pendingLabel };
  }

  // Non-retry path: Check and Continue are ALWAYS separate button
  // instances. This eliminates the fall-through where a fast second
  // click or held Enter on the old single swapping button would skip
  // the card. No timer / disable-window is needed.
  if (!retryActive) {
    if (effectiveResult) {
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

  if (isTerminal) {
    return {
      kind: 'continue',
      disabled: Boolean(isSubmitting) || !onContinue,
      onContinue,
    };
  }

  // working / wrong: Check + optional Reveal answer.
  return {
    kind: 'retryCheck',
    disabled: !canCheck || Boolean(isSubmitting),
    canReveal: Boolean(retry?.canReveal),
    onCheck,
    onReveal: retry?.onReveal ?? (() => {}),
  };
}

/**
 * Derive a short contextual status string for the action bar's left side.
 * - Before Check: prompts the next action ("Select an answer" / custom
 *   progress hint from statusHint / "Ready to check").
 * - After Check: an action cue that stays distinct from the result banner
 *   text ("Correct" / "Not quite") so both remain independently queryable.
 */
export function footerStatus(
  result: OperationResult | null,
  canCheck: boolean,
  statusHint: string | undefined,
  retryPhase: RetryPhase | undefined,
  ownsResultFeedback: boolean,
) {
  if (result) {
    if (ownsResultFeedback && statusHint) return statusHint;
    return result.correct ? 'Nice work' : 'Review the answer';
  }
  if (canCheck) return 'Ready to check';
  // In a retry-wrong state the board is already filled but Check is gated
  // on a board change (dirty). The generic "Select an answer" is misleading
  // because nothing is missing — guide the learner to change their answer.
  if (retryPhase === 'wrong') {
    return 'Adjust your answer to try again.';
  }
  return statusHint ?? 'Select an answer';
}

interface BannerViewInput {
  effectiveResult: OperationResult | null;
  ownsResultFeedback: boolean;
  retryActive: boolean;
  retryPhase: RetryPhase | undefined;
}

export function buildBannerKind({
  effectiveResult,
  ownsResultFeedback,
  retryActive,
  retryPhase,
}: BannerViewInput): BannerKind | null {
  if (retryActive) {
    if (retryPhase === 'wrong') return 'wrong';
    if (retryPhase === 'revealed' && !ownsResultFeedback) return 'revealed';
    if (retryPhase === 'solved' && !ownsResultFeedback) return 'solved';
    return null;
  }
  if (ownsResultFeedback || !effectiveResult) {
    return null;
  }
  return effectiveResult.correct ? 'solved' : 'incorrect';
}

export function buildStatusTone(
  effectiveResult: OperationResult | null,
  bannerKind: BannerKind | null,
  canCheck: boolean,
): StatusTone {
  if (effectiveResult) {
    return effectiveResult.correct ? 'accent' : 'destructive';
  }
  if (bannerKind === 'wrong' && !canCheck) {
    return 'destructive';
  }
  return 'muted';
}

export interface OperationShellView {
  effectiveResult: OperationResult | null;
  bannerKind: BannerKind | null;
  hasBanner: boolean;
  status: string;
  statusTone: StatusTone;
  ariaLive: 'polite' | undefined;
  resultHint: ReactNode;
  showExplanation: boolean;
}

interface ShellViewInput {
  canCheck: boolean;
  ownsResultFeedback: boolean;
  pendingLabel: string;
  pending: boolean;
  result: OperationResult | null;
  retryActive: boolean;
  retryPhase: RetryPhase | undefined;
  isTerminal: boolean;
  statusHint: string | undefined;
  wrongHint: ReactNode;
  explanation: Spans | null;
}

/**
 * Single derivation of everything the shell renders from its result/retry
 * state: effective result, banner kind, footer status text and tone, live
 * region behavior, and the explanation slot.
 */
export function buildOperationShellView(
  input: ShellViewInput,
): OperationShellView {
  const {
    canCheck,
    explanation,
    isTerminal,
    ownsResultFeedback,
    pending,
    pendingLabel,
    result,
    retryActive,
    retryPhase,
    statusHint,
    wrongHint,
  } = input;

  const effectiveResult: OperationResult | null = retryActive
    ? isTerminal
      ? (result ?? null)
      : null
    : (result ?? null);

  const bannerKind = buildBannerKind({
    effectiveResult,
    ownsResultFeedback,
    retryActive,
    retryPhase,
  });
  const hasBanner = bannerKind !== null;

  return {
    effectiveResult,
    bannerKind,
    hasBanner,
    status: pending
      ? pendingLabel
      : footerStatus(
          effectiveResult,
          canCheck,
          statusHint,
          retryPhase,
          ownsResultFeedback,
        ),
    statusTone: buildStatusTone(effectiveResult, bannerKind, canCheck),
    ariaLive: hasBanner ? undefined : 'polite',
    resultHint:
      !retryActive && effectiveResult && !effectiveResult.correct
        ? wrongHint
        : null,
    showExplanation: hasVisibleExplanation(
      explanation,
      bannerKind,
      retryActive,
      effectiveResult,
    ),
  };
}

/**
 * The authored explanation is terminal feedback: it stays out of the
 * answerable view and appears once, below the operation-specific result.
 * A wrong retry phase is not terminal — the learner is still working.
 */
export function hasVisibleExplanation(
  explanation: Spans | null,
  bannerKind: BannerKind | null,
  retryActive: boolean,
  effectiveResult: OperationResult | null,
): boolean {
  if (!explanation) {
    return false;
  }
  if (bannerKind === 'solved' || bannerKind === 'revealed') {
    return true;
  }
  return !retryActive && effectiveResult !== null;
}
