import { Button, Heading, Text, textVariants } from '@flyt/ui';
import { useState } from 'react';

import { SpanView } from '@/components/portable/SpanView';
import { cn } from '@/lib/utils';
import type { WriteExercise } from '@/types/lesson-contracts';

import { exercisePromptId, spanPlainText } from '../flashcard-utils';
import type { DraftStatus } from './useWriteResponseState';
import type { CountState } from './wordCount';

const K_WRITE_TASK_CLAMP_CHARS = 180;

export function WriteTask({ exercise }: { exercise: WriteExercise }) {
  const [expanded, setExpanded] = useState(false);
  if (!exercise.prompt.length) return null;

  const promptId = exercisePromptId(exercise.id);
  const clampable =
    spanPlainText(exercise.prompt).length > K_WRITE_TASK_CLAMP_CHARS;

  return (
    <div
      className="radius-field border border-default bg-neutral p-4"
      data-testid="write-task"
    >
      <Heading as="div" size="xxsmall" tone="subtle">
        Task
      </Heading>
      <p
        className={cn(
          textVariants({ size: 'medium', smSize: 'large' }),
          'mt-2 text-default text-pretty',
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
          className={`mt-2 self-start text-subtle underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-[var(--border-focused)] focus-visible:outline-none sm:hidden ${textVariants({ role: 'eyebrow' })}`}
          onClick={() => setExpanded((open) => !open)}
          type="button"
        >
          <span aria-hidden="true" className="mr-1">
            {expanded ? '▼' : '▶'}
          </span>
          {expanded ? 'Show less' : 'Show full task'}
        </button>
      ) : null}
    </div>
  );
}

export function WriteEditor({
  ariaDescribedBy,
  characterLabel,
  countLabel,
  countState,
  disabled,
  draftStatus,
  response,
  responseTooLong,
  onChange,
}: {
  ariaDescribedBy: string | undefined;
  characterLabel: string | null;
  countLabel: string | null;
  countState: CountState;
  disabled: boolean;
  draftStatus: DraftStatus | null;
  response: string;
  responseTooLong: boolean;
  onChange: (next: string) => void;
}) {
  return (
    <div
      className={cn(
        'radius-field shadow-tile flex min-h-48 flex-1 flex-col overflow-hidden border bg-raised transition-colors',
        'focus-within:ring-2 focus-within:ring-[var(--border-focused)]',
        responseTooLong ? 'border-danger-subtle' : 'border-default',
        disabled && 'opacity-60',
      )}
      data-testid="write-editor"
    >
      <textarea
        aria-describedby={ariaDescribedBy}
        aria-label="Your response in Norwegian"
        className={`min-h-28 w-full flex-1 resize-none bg-transparent px-4 py-3 text-default placeholder:text-subtle focus-visible:outline-none disabled:cursor-not-allowed ${textVariants({ size: 'large' })}`}
        disabled={disabled}
        lang="no"
        onChange={(event) => onChange(event.target.value)}
        placeholder="Skriv svaret ditt her…"
        spellCheck={false}
        value={response}
      />
      <div
        className="flex items-center justify-between gap-3 px-4 py-2"
        data-testid="write-editor-status"
      >
        <DraftStatusLine draftStatus={draftStatus} />
        <div className="flex items-center gap-3">
          {countLabel ? (
            <p
              aria-live="polite"
              className={cn(
                textVariants({ size: 'small' }),
                countState === 'under' && 'text-subtle',
                countState === 'in-range' && 'text-success',
                countState === 'over' && 'text-warning',
              )}
            >
              {countLabel}
            </p>
          ) : null}
          {characterLabel ? (
            <p
              className={cn(
                textVariants({ size: 'small' }),
                responseTooLong ? 'text-danger' : 'text-subtle',
              )}
            >
              {characterLabel}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DraftStatusLine({ draftStatus }: { draftStatus: DraftStatus | null }) {
  if (!draftStatus) {
    return <span />;
  }

  return (
    <p
      className={cn(
        textVariants({ role: 'eyebrow' }),
        draftStatus === 'saved' ? 'text-success' : 'text-warning',
      )}
      role="status"
    >
      {draftStatus === 'saved'
        ? 'Draft saved on this device'
        : 'Draft not saved'}
    </p>
  );
}

export function WriteNotices({
  draftStatus,
  phase,
  validationMessage,
}: {
  draftStatus: DraftStatus | null;
  phase: string;
  validationMessage: string | null;
}) {
  return (
    <>
      {phase === 'unavailable' ? (
        <div className="radius-field border border-warning-subtle bg-warning-subtle p-3">
          <Text size="medium" tone="default">
            We couldn&rsquo;t check this right now.{' '}
            {draftStatus === 'saved'
              ? 'Your response is saved and you can keep going.'
              : 'Your response remains here, but it could not be saved for later.'}
          </Text>
        </div>
      ) : null}
      {validationMessage ? (
        <p
          className={`text-danger ${textVariants({ size: 'medium' })}`}
          role="alert"
        >
          {validationMessage}
        </p>
      ) : null}
    </>
  );
}

export function WriteAlternativeActions({
  phase,
  onContinueUngraded,
  onRevise,
  onSkip,
}: {
  phase: string;
  onContinueUngraded: () => void;
  onRevise: () => void;
  onSkip: () => void;
}) {
  if (phase === 'composing') {
    return (
      <Button width="full-on-mobile" onClick={onSkip} variant="ghost">
        Skip for now
      </Button>
    );
  }

  if (phase !== 'result' && phase !== 'unavailable') {
    return null;
  }

  return (
    <>
      <Button width="full-on-mobile" onClick={onRevise} variant="outline">
        Revise
      </Button>
      {phase === 'unavailable' ? (
        <Button
          width="full-on-mobile"
          onClick={onContinueUngraded}
          shape="pill"
        >
          Continue ungraded
        </Button>
      ) : null}
    </>
  );
}
