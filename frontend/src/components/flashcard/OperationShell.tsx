import { Loader2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Button } from '@/components/common/Button/Button';
import { SpanView } from '@/components/portable/SpanView';
import { useCardShake } from '@/hooks/flashcard/useCardShake/useCardShake';
import type { CheckablePhase } from '@/hooks/flashcard/useCheckableExercise/useCheckableExercise';
import { type OperationResult } from '@/lib/operationResult';
import { cn } from '@/lib/utils';
import type { Exercise } from '@/types/lesson-contracts';

import { exercisePromptId, spanPlainText } from './flashcard-utils';
import { FlashCardFrame } from './FlashCardFrame';

/**
 * Shared "stimulus sentence" surface — the Norwegian sentence a learner
 * reads before answering. Used by operations that present a single boxed
 * sentence (Judge, Choose stem). Cards with a different surface (FindFix's
 * reading panel, RecallFill's bare segments) intentionally diverge.
 */
export const stimulusSentenceClassName =
  'radius-field text-prompt border border-border bg-secondary-5 p-4 leading-roomy text-foreground text-balance';

/**
 * Re-exported as a type alias so the canonical phase union lives in one
 * place (`useCheckableExercise`) and both the hook and the shell share it.
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

type OperationShellProps = {
  exercise: Exercise;
  className?: string;
  bodyClassName?: string;
  desktopExpanded?: boolean;
  isSubmitting?: boolean;
  result?: OperationResult | null;
  canCheck?: boolean;
  /**
   * Optional partial-progress hint shown in the footer before Check.
   * When canCheck is false and no result exists, this string replaces
   * the generic "Select an answer" prompt (e.g. "1 of 3 paired").
   */
  statusHint?: string;
  /**
   * Short "how to play" cue rendered above the work surface. Each operation
   * passes its own interaction hint (e.g. "Tap a word to fill the blank")
   * so every exercise type carries a consistent instructor line.
   */
  instruction?: ReactNode;
  /** Render a long authored prompt as learner-facing instruction. */
  promptAsInstruction?: boolean;
  /** Keep the authored prompt in the operation work surface. */
  promptInWorkSurface?: boolean;
  /**
   * The operation renders its own terminal verdict, so the shell drops the
   * generic Correct / Not quite banner and keeps `statusHint` in the footer
   * instead of restating the outcome.
   */
  ownsResultFeedback?: boolean;
  /**
   * The child fills the work surface instead of shrink-wrapping in its
   * centre. Feedback then shrinks the child rather than moving the footer,
   * so the shell stops reserving blank space for the banner.
   */
  fillWorkSurface?: boolean;
  /** Put the contextual status above actions on narrow write surfaces. */
  statusFirstOnMobile?: boolean;
  /** Allow long writing surfaces to grow naturally instead of nesting mobile scroll. */
  naturalHeightOnMobile?: boolean;
  /**
   * Optional extra line shown inside the result banner after an incorrect
   * answer (e.g. "Review the pairs."). Owned by the operation so the shell
   * stays agnostic of any specific exercise type.
   *
   * Dead when `retry` is present (the retry banner owns wrong-state copy).
   */
  wrongHint?: ReactNode;
  /**
   * True while a remote check is in flight. Operations judged locally never
   * set this; `speak` (STT) and `write` (judge service) do, because they are
   * the only operations that cannot promise a verdict synchronously.
   */
  pending?: boolean;
  /** Label for the primary button while `pending`. */
  pendingLabel?: string;
  /**
   * Escape hatch rendered beside the primary action — "Skip", "Continue
   * anyway". Present only where hardware or a service can block completion.
   */
  escapeAction?: ReactNode;
  onCheck: () => void;
  onContinue?: () => void;
  /**
   * Opt-in retry mode. When present, the shell drives the footer/banner
   * from `retry.phase` instead of `result`; the component must pass
   * `result=null` until a terminal phase (`solved` / `revealed`) is
   * reached. When absent, behavior is byte-for-byte the original
   * commit-on-check path used by Judge/Choose/Cloze/etc.
   */
  retry?: RetryConfig;
  children: ReactNode;
};

/**
 * Derive a short contextual status string for the action bar's left side.
 * - Before Check: prompts the next action ("Select an answer" / custom
 *   progress hint from statusHint / "Ready to check").
 * - After Check: an action cue that stays distinct from the result banner
 *   text ("Correct" / "Not quite") so both remain independently queryable.
 */
function footerStatus(
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

const K_INSTRUCTION_CLAMP_CHARS = 180;

/**
 * A multi-sentence authored task would otherwise fill a phone screen before
 * the learner reaches the work surface, so long instructions clamp on small
 * viewports behind the shared disclosure control and stay in the a11y tree.
 */
function InstructionPrompt({ exercise }: { exercise: Exercise }) {
  const [expanded, setExpanded] = useState(false);
  const promptId = exercisePromptId(exercise.id);
  const clampable =
    spanPlainText(exercise.prompt).length > K_INSTRUCTION_CLAMP_CHARS;

  return (
    <>
      <p
        id={promptId}
        data-testid="exercise-prompt"
        className={cn(
          'type-caption sm:type-body max-w-text text-foreground text-pretty',
          clampable && !expanded && 'line-clamp-3 sm:line-clamp-none',
        )}
      >
        <SpanView spans={exercise.prompt} />
      </p>
      {clampable ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={promptId}
          onClick={() => setExpanded((open) => !open)}
          className="type-label-xs mt-0.5 inline-flex min-h-11 items-center self-start px-2 text-muted-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:hidden"
        >
          <span aria-hidden="true" className="mr-1">
            {expanded ? '▼' : '▶'}
          </span>
          {expanded ? 'Show less' : 'Show full task'}
        </button>
      ) : null}
    </>
  );
}

export function OperationShell({
  exercise,
  className,
  bodyClassName = 'bg-transparent',
  desktopExpanded,
  isSubmitting,
  result,
  canCheck = true,
  statusHint,
  instruction,
  promptAsInstruction = false,
  promptInWorkSurface = false,
  ownsResultFeedback = false,
  fillWorkSurface = false,
  statusFirstOnMobile = false,
  naturalHeightOnMobile = false,
  wrongHint,
  pending = false,
  pendingLabel = 'Checking…',
  escapeAction,
  onCheck,
  onContinue,
  retry,
  children,
}: OperationShellProps) {
  const retryActive = Boolean(retry);
  const retryPhase = retry?.phase;
  const isTerminal = retryPhase === 'solved' || retryPhase === 'revealed';

  // In retry mode, the effective result is whatever the component passes
  // (non-null only in terminal phases). In non-retry mode it's the legacy
  // commit-on-check `result`.
  const effectiveResult: OperationResult | null = retryActive
    ? isTerminal
      ? (result ?? null)
      : null
    : (result ?? null);

  const status = pending
    ? pendingLabel
    : footerStatus(
        effectiveResult,
        canCheck,
        statusHint,
        retryPhase,
        ownsResultFeedback,
      );
  const resultHint =
    !retryActive && effectiveResult && !effectiveResult.correct
      ? wrongHint
      : null;

  const reducedMotion = Boolean(useReducedMotion());
  const { controls, shake } = useCardShake();
  const continueRef = useRef<HTMLButtonElement | null>(null);

  // Move focus to the Continue button when it appears (terminal phase in
  // retry mode, or any result in non-retry mode) so keyboard / SR users can
  // advance without re-finding the footer.
  const showContinue = retryActive ? isTerminal : Boolean(effectiveResult);

  useEffect(() => {
    if (showContinue) {
      continueRef.current?.focus();
    }
  }, [showContinue]);

  const showWrongBanner = retryActive && retryPhase === 'wrong';
  const shakeKey = retry && !reducedMotion ? retry.shakeKey : null;

  useEffect(() => {
    if (showWrongBanner && !reducedMotion) {
      shake();
    } else {
      controls.set({ x: 0 });
    }
  }, [showWrongBanner, reducedMotion, shakeKey, shake, controls]);

  const showRevealedBanner =
    retryActive && retryPhase === 'revealed' && !ownsResultFeedback;
  const showSolvedBanner =
    (!ownsResultFeedback && retryActive && retryPhase === 'solved') ||
    (!retryActive && !ownsResultFeedback && effectiveResult?.correct);
  const showIncorrectBanner = Boolean(
    !retryActive &&
    !ownsResultFeedback &&
    effectiveResult &&
    !effectiveResult.correct,
  );
  const hasBanner = Boolean(
    showWrongBanner ||
    showRevealedBanner ||
    showSolvedBanner ||
    showIncorrectBanner,
  );
  // The authored explanation is terminal feedback: it stays out of the
  // answerable view and appears once, below the operation-specific result.
  // A wrong retry phase is not terminal — the learner is still working.
  const showExplanation =
    Boolean(exercise.explanation?.length) &&
    (showSolvedBanner ||
      showRevealedBanner ||
      (!retryActive && effectiveResult !== null));

  const renderFooter = () => {
    if (pending) {
      return (
        <Button variant="pill" className="w-full sm:w-auto" disabled>
          <Loader2
            aria-hidden="true"
            className={cn('mr-1 size-4', !reducedMotion && 'animate-spin')}
          />
          {pendingLabel}
        </Button>
      );
    }

    if (!retryActive) {
      // Non-retry path: Check and Continue are ALWAYS separate button
      // instances. This eliminates the fall-through where a fast second
      // click or held Enter on the old single swapping button would skip
      // the card. No timer / disable-window is needed.
      if (effectiveResult) {
        return (
          <Button
            ref={continueRef}
            variant="pill"
            className="w-full sm:w-auto"
            disabled={isSubmitting || !onContinue}
            onClick={onContinue}
          >
            Continue
            <span aria-hidden="true" className="ml-0.5">
              →
            </span>
          </Button>
        );
      }
      return (
        <Button
          variant="pill"
          className="w-full sm:w-auto"
          disabled={!canCheck || isSubmitting}
          onClick={onCheck}
        >
          Check
          <span aria-hidden="true" className="ml-0.5">
            →
          </span>
        </Button>
      );
    }

    if (isTerminal) {
      return (
        <Button
          ref={continueRef}
          variant="pill"
          className="w-full sm:w-auto"
          disabled={isSubmitting || !onContinue}
          onClick={onContinue}
        >
          Continue
          <span aria-hidden="true" className="ml-0.5">
            →
          </span>
        </Button>
      );
    }

    // working / wrong: Check + optional Reveal answer.
    return (
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        {retry?.canReveal ? (
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={retry.onReveal}
          >
            Reveal answer
          </Button>
        ) : null}
        <Button
          variant="pill"
          className="w-full sm:w-auto"
          disabled={!canCheck || isSubmitting}
          onClick={onCheck}
        >
          Check
          <span aria-hidden="true" className="ml-0.5">
            →
          </span>
        </Button>
      </div>
    );
  };

  return (
    <FlashCardFrame
      className={className}
      desktopExpanded={desktopExpanded}
      bodyClassName={bodyClassName}
      headerless
      bodyFill
      naturalHeightOnMobile={naturalHeightOnMobile}
      hasFooterDivider={false}
      footer={
        <div
          data-testid="flashcard-footer"
          className={cn(
            'flex gap-2 sm:flex-row sm:items-center sm:justify-between',
            statusFirstOnMobile ? 'flex-col' : 'flex-col-reverse',
          )}
        >
          <p
            className={cn(
              'type-caption',
              effectiveResult
                ? effectiveResult.correct
                  ? 'text-accent-80'
                  : 'text-destructive'
                : showWrongBanner && !canCheck
                  ? 'text-destructive'
                  : 'text-muted-foreground',
            )}
            data-testid="flashcard-action-status"
            aria-live={hasBanner ? undefined : 'polite'}
          >
            {status}
          </p>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            {escapeAction}
            {renderFooter()}
          </div>
        </div>
      }
    >
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col',
          naturalHeightOnMobile && 'min-h-max flex-none sm:min-h-0 sm:flex-1',
        )}
        data-testid="operation-body"
      >
        <div
          className="mb-4 flex flex-col gap-3"
          data-testid="operation-header"
        >
          <div className="flex flex-col gap-1">
            {exercise.prompt.length ? (
              promptInWorkSurface ? (
                <h2 className="font-display text-prompt font-semibold leading-prompt text-foreground capitalize text-balance">
                  {exercise.operation.replace('_', ' ')}
                </h2>
              ) : promptAsInstruction ? (
                <>
                  <p className="font-display type-label leading-flat text-muted-foreground capitalize">
                    {exercise.operation.replace('_', ' ')}
                  </p>
                  <InstructionPrompt exercise={exercise} />
                </>
              ) : (
                <>
                  <p className="font-display type-label leading-flat text-muted-foreground">
                    {exercise.operation.replace('_', ' ')}
                  </p>
                  <h2
                    data-testid="exercise-prompt"
                    className="font-display text-prompt font-semibold leading-prompt text-foreground text-balance"
                  >
                    <SpanView spans={exercise.prompt} />
                  </h2>
                </>
              )
            ) : (
              <h2 className="font-display text-prompt font-semibold leading-prompt text-foreground capitalize text-balance">
                {exercise.operation.replace('_', ' ')}
              </h2>
            )}
          </div>
          {instruction ? (
            <div className="flex items-start gap-2.5">
              <span
                aria-hidden="true"
                className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-primary-20 bg-primary-10 font-serif text-[0.8rem] leading-none font-semibold text-primary-80 italic"
              >
                i
              </span>
              <p className="type-caption text-muted-foreground">
                {instruction}
              </p>
            </div>
          ) : null}
        </div>

        <motion.div
          key={`work-surface-shake-${shakeKey ?? 'none'}`}
          data-testid="work-surface"
          animate={controls}
          className={cn(
            'radius-section surface-mat flex w-full flex-1 flex-col gap-4 p-5 sm:p-6',
            fillWorkSurface ? 'min-h-max sm:min-h-[18rem]' : 'min-h-[18rem]',
            !fillWorkSurface && 'justify-center',
          )}
        >
          {children}

          {/*
            Banner slot — kept in the layout while empty so the footer button
            does not jump when feedback appears. A filled work surface absorbs
            that height by shrinking instead, so it renders the slot only when
            there is feedback. Only one banner variant is ever visible at a
            time.

            The wrong-phase banner intentionally carries no role/aria-live here
            (SR announcement is handled by the keyed sr-only live region below
            so it re-announces correctly on every wrong attempt without
            remounting this element).
          */}
          {hasBanner || !fillWorkSurface ? (
            <div
              {...(showRevealedBanner || showSolvedBanner || showIncorrectBanner
                ? { role: 'status' }
                : {})}
              data-testid="operation-banner"
              aria-hidden={!hasBanner}
              className={cn(
                'radius-field type-caption border p-3',
                showWrongBanner
                  ? 'border-destructive-20 bg-destructive-0 text-destructive-80'
                  : showRevealedBanner
                    ? 'border-border bg-secondary-5 text-foreground'
                    : showSolvedBanner
                      ? 'border-accent-20 bg-accent-0 text-accent-90'
                      : showIncorrectBanner
                        ? 'border-destructive-20 bg-destructive-0 text-destructive-80'
                        : 'invisible',
              )}
            >
              {showWrongBanner &&
                'Incorrect — adjust your answer and try again.'}
              {showRevealedBanner && "Here's the answer."}
              {showSolvedBanner && 'Correct'}
              {showIncorrectBanner && (
                <>
                  Not quite
                  {resultHint ? (
                    <p className="mt-1 text-foreground">{resultHint}</p>
                  ) : null}
                </>
              )}
              {!hasBanner && ' '}
            </div>
          ) : null}

          {showExplanation && exercise.explanation ? (
            <div
              data-testid="exercise-explanation"
              className="radius-field type-caption border border-border bg-secondary-5 p-3 text-muted-foreground"
            >
              <SpanView spans={exercise.explanation} />
            </div>
          ) : null}
        </motion.div>

        {/*
          Separate visually-hidden live region for screen-reader users.
          The wrong-phase message above lives inside the animated container
          whose `key` may change (remount) only for motion users; for
          reduced-motion users the container does NOT remount, so a repeat
          wrong check would not re-announce. Keying this sr-only element on
          `retry.shakeKey` forces a remount here per attempt, decoupling the
          SR announcement from the animated container for everyone.
        */}
        {showWrongBanner ? (
          <p
            key={`sr-retry-announce-${retry?.shakeKey ?? 0}`}
            className="sr-only"
            role="alert"
          >
            Incorrect — adjust your answer and try again.
          </p>
        ) : null}
      </div>
    </FlashCardFrame>
  );
}
