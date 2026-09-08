import { m, useReducedMotion } from 'motion/react';
import { useEffect, useRef, type ReactNode } from 'react';

import { SpanView } from '@/components/portable/SpanView';
import { useCardShake } from '@/hooks/flashcard/useCardShake/useCardShake';
import type { OperationResult } from '@/lib/operationResult';
import { cn } from '@/lib/utils';
import type { Exercise } from '@/types/lesson-contracts';

import { FlashCardFrame } from './FlashCardFrame';
import { OperationBannerSlot, OperationHeader } from './OperationShellBody';
import { OperationFooterBar } from './OperationShellFooter';
import {
  buildFooterView,
  buildOperationShellView,
  type RetryConfig,
  type RetryPhase,
} from './operationShellView';

/**
 * Shared "stimulus sentence" surface — the Norwegian sentence a learner
 * reads before answering. Used by operations that present a single boxed
 * sentence (Judge, Choose stem). Cards with a different surface (FindFix's
 * reading panel, RecallFill's bare segments) intentionally diverge.
 */
export const stimulusSentenceClassName =
  'radius-field text-prompt border border-border bg-secondary-5 p-4 leading-roomy text-foreground text-balance';

export type { RetryConfig, RetryPhase };

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

  const view = buildOperationShellView({
    canCheck,
    explanation: exercise.explanation,
    isTerminal,
    ownsResultFeedback,
    pending,
    pendingLabel,
    result: result ?? null,
    retryActive,
    retryPhase,
    statusHint,
    wrongHint,
  });

  const reducedMotion = Boolean(useReducedMotion());
  const { controls, shake } = useCardShake();
  const continueRef = useRef<HTMLButtonElement | null>(null);

  // Move focus to the Continue button when it appears (terminal phase in
  // retry mode, or any result in non-retry mode) so keyboard / SR users can
  // advance without re-finding the footer.
  const showContinue = retryActive ? isTerminal : Boolean(view.effectiveResult);

  useEffect(() => {
    if (showContinue) {
      continueRef.current?.focus();
    }
  }, [showContinue]);

  const shakeKey = retry && !reducedMotion ? retry.shakeKey : null;

  useEffect(() => {
    if (view.bannerKind === 'wrong' && !reducedMotion) {
      shake();
    } else {
      controls.set({ x: 0 });
    }
  }, [view.bannerKind, reducedMotion, shakeKey, shake, controls]);

  const footerView = buildFooterView({
    canCheck,
    effectiveResult: view.effectiveResult,
    isSubmitting,
    isTerminal,
    onCheck,
    onContinue,
    pending,
    pendingLabel,
    retry,
    retryActive,
  });

  return (
    <FlashCardFrame
      bodyClassName={bodyClassName}
      bodyFill
      className={className}
      desktopExpanded={desktopExpanded}
      footer={
        <OperationFooterBar
          ariaLive={view.ariaLive}
          continueRef={continueRef}
          escapeAction={escapeAction}
          footerView={footerView}
          reducedMotion={reducedMotion}
          status={view.status}
          statusFirstOnMobile={statusFirstOnMobile}
          statusTone={view.statusTone}
        />
      }
      hasFooterDivider={false}
      headerless
      naturalHeightOnMobile={naturalHeightOnMobile}
    >
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col',
          naturalHeightOnMobile && 'min-h-max flex-none sm:min-h-0 sm:flex-1',
        )}
        data-testid="operation-body"
      >
        <OperationHeader
          exercise={exercise}
          instruction={instruction}
          promptAsInstruction={promptAsInstruction}
          promptInWorkSurface={promptInWorkSurface}
        />

        <m.div
          animate={controls}
          className={cn(
            'radius-section surface-mat flex w-full flex-1 flex-col gap-4 p-5 sm:p-6',
            fillWorkSurface ? 'min-h-max sm:min-h-[18rem]' : 'min-h-[18rem]',
            !fillWorkSurface && 'justify-center',
          )}
          data-testid="work-surface"
          key={`work-surface-shake-${shakeKey ?? 'none'}`}
        >
          {children}

          <OperationBannerSlot
            bannerKind={view.bannerKind}
            hasBanner={view.hasBanner}
            reserved={!fillWorkSurface}
            resultHint={view.resultHint}
          />

          {view.showExplanation && exercise.explanation ? (
            <div
              className="radius-field type-caption border border-border bg-secondary-5 p-3 text-muted-foreground"
              data-testid="exercise-explanation"
            >
              <SpanView spans={exercise.explanation} />
            </div>
          ) : null}
        </m.div>

        {/*
          Separate visually-hidden live region for screen-reader users.
          The wrong-phase message above lives inside the animated container
          whose `key` may change (remount) only for motion users; for
          reduced-motion users the container does NOT remount, so a repeat
          wrong check would not re-announce. Keying this sr-only element on
          `retry.shakeKey` forces a remount here per attempt, decoupling the
          SR announcement from the animated container for everyone.
        */}
        {view.bannerKind === 'wrong' ? (
          <p
            className="sr-only"
            key={`sr-retry-announce-${retry?.shakeKey ?? 0}`}
            role="alert"
          >
            Incorrect — adjust your answer and try again.
          </p>
        ) : null}
      </div>
    </FlashCardFrame>
  );
}
