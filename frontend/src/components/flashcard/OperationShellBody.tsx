import { useState, type ReactNode } from 'react';

import { SpanView } from '@/components/portable/SpanView';
import { cn } from '@/lib/utils';
import type { Exercise } from '@/types/lesson-contracts';

import { exercisePromptId, spanPlainText } from './flashcard-utils';
import type { BannerKind } from './operationShellView';

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
        className={cn(
          'type-caption sm:type-body max-w-text text-foreground text-pretty',
          clampable && !expanded && 'line-clamp-3 sm:line-clamp-none',
        )}
        data-testid="exercise-prompt"
        id={promptId}
      >
        <SpanView spans={exercise.prompt} />
      </p>
      {clampable ? (
        <button
          aria-controls={promptId}
          aria-expanded={expanded}
          className="type-label-xs mt-0.5 inline-flex min-h-11 items-center self-start px-2 text-muted-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:hidden"
          onClick={() => setExpanded((open) => !open)}
          type="button"
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

function PromptHeading({ exercise }: { exercise: Exercise }) {
  return (
    <h2
      className="font-display text-prompt font-semibold leading-prompt text-foreground text-balance"
      data-testid="exercise-prompt"
    >
      <SpanView spans={exercise.prompt} />
    </h2>
  );
}

function OperationTitle({ exercise }: { exercise: Exercise }) {
  const capitalized = exercise.operation.replace('_', ' ');
  return (
    <h2 className="font-display text-prompt font-semibold leading-prompt text-foreground capitalize text-balance">
      {capitalized}
    </h2>
  );
}

function OperationLabel({ exercise }: { exercise: Exercise }) {
  return (
    <p className="font-display type-label leading-flat text-muted-foreground">
      {exercise.operation.replace('_', ' ')}
    </p>
  );
}

function OperationLabelCapitalized({ exercise }: { exercise: Exercise }) {
  return (
    <p className="font-display type-label leading-flat text-muted-foreground capitalize">
      {exercise.operation.replace('_', ' ')}
    </p>
  );
}

/**
 * The "stimulus header": operation label plus the authored prompt, or the
 * prompt promoted to a learner-facing instruction paragraph.
 */
export function OperationHeader({
  exercise,
  instruction,
  promptAsInstruction,
  promptInWorkSurface,
}: {
  exercise: Exercise;
  instruction?: ReactNode;
  promptAsInstruction: boolean;
  promptInWorkSurface: boolean;
}) {
  const hasPrompt = exercise.prompt.length > 0;

  return (
    <div className="mb-4 flex flex-col gap-3" data-testid="operation-header">
      <div className="flex flex-col gap-1">
        {!hasPrompt ? (
          <OperationTitle exercise={exercise} />
        ) : promptInWorkSurface ? (
          <OperationTitle exercise={exercise} />
        ) : promptAsInstruction ? (
          <>
            <OperationLabelCapitalized exercise={exercise} />
            <InstructionPrompt exercise={exercise} />
          </>
        ) : (
          <>
            <OperationLabel exercise={exercise} />
            <PromptHeading exercise={exercise} />
          </>
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
          <p className="type-caption text-muted-foreground">{instruction}</p>
        </div>
      ) : null}
    </div>
  );
}

const BANNER_KIND_CLASS: Record<BannerKind, string> = {
  wrong: 'border-destructive-20 bg-destructive-0 text-destructive-80',
  revealed: 'border-border bg-secondary-5 text-foreground',
  solved: 'border-accent-20 bg-accent-0 text-accent-90',
  incorrect: 'border-destructive-20 bg-destructive-0 text-destructive-80',
};

/**
 * Banner slot — kept in the layout while empty so the footer button
 * does not jump when feedback appears. A filled work surface absorbs
 * that height by shrinking instead, so it renders the slot only when
 * there is feedback. Only one banner variant is ever visible at a
 * time.
 *
 * The wrong-phase banner intentionally carries no role/aria-live here
 * (SR announcement is handled by the keyed sr-only live region in the
 * shell so it re-announces correctly on every wrong attempt without
 * remounting this element).
 */
export function OperationBannerSlot({
  bannerKind,
  hasBanner,
  reserved,
  resultHint,
}: {
  bannerKind: BannerKind | null;
  hasBanner: boolean;
  reserved: boolean;
  resultHint: ReactNode;
}) {
  if (!hasBanner && !reserved) {
    return null;
  }

  const isAnnouncedBanner =
    bannerKind === 'revealed' ||
    bannerKind === 'solved' ||
    bannerKind === 'incorrect';

  return (
    <div
      {...(isAnnouncedBanner ? { role: 'status' } : {})}
      aria-hidden={!hasBanner}
      className={cn(
        'radius-field type-caption border p-3',
        bannerKind === null ? 'invisible' : BANNER_KIND_CLASS[bannerKind],
      )}
      data-testid="operation-banner"
    >
      <BannerContent
        bannerKind={bannerKind}
        hasBanner={hasBanner}
        resultHint={resultHint}
      />
    </div>
  );
}

function BannerContent({
  bannerKind,
  hasBanner,
  resultHint,
}: {
  bannerKind: BannerKind | null;
  hasBanner: boolean;
  resultHint: ReactNode;
}) {
  if (bannerKind === 'wrong') {
    return <>Incorrect — adjust your answer and try again.</>;
  }
  if (bannerKind === 'revealed') {
    return <>Here's the answer.</>;
  }
  if (bannerKind === 'solved') {
    return <>Correct</>;
  }
  if (bannerKind === 'incorrect') {
    return (
      <>
        Not quite
        {resultHint ? (
          <p className="mt-1 text-foreground">{resultHint}</p>
        ) : null}
      </>
    );
  }
  return <>{!hasBanner && ' '}</>;
}
