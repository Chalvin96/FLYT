import { useState } from 'react';

import { Button } from '@/components/common/Button/Button';
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
      className="radius-field border border-border bg-secondary-5 p-4"
      data-testid="write-task"
    >
      <p className="font-display type-label leading-flat text-muted-foreground">
        Task
      </p>
      <p
        className={cn(
          'type-caption mt-2 text-foreground text-pretty sm:type-body',
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
          className="type-label-xs mt-2 self-start text-muted-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:hidden"
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
        'radius-field shadow-tile flex min-h-48 flex-1 flex-col overflow-hidden border bg-card transition-colors',
        'focus-within:ring-2 focus-within:ring-ring',
        responseTooLong ? 'border-destructive-20' : 'border-border',
        disabled && 'opacity-60',
      )}
      data-testid="write-editor"
    >
      <textarea
        aria-describedby={ariaDescribedBy}
        aria-label="Your response in Norwegian"
        className="type-body min-h-28 w-full flex-1 resize-none bg-transparent px-4 py-3 leading-roomy text-foreground placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed"
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
                'type-caption-sm',
                countState === 'under' && 'text-muted-foreground',
                countState === 'in-range' && 'text-accent-80',
                countState === 'over' && 'text-warning-60',
              )}
            >
              {countLabel}
            </p>
          ) : null}
          {characterLabel ? (
            <p
              className={cn(
                'type-caption-sm',
                responseTooLong ? 'text-destructive' : 'text-muted-foreground',
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
        'type-label-xs',
        draftStatus === 'saved' ? 'text-accent-80' : 'text-warning-60',
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
        <div className="radius-field border border-warning-30 bg-warning-10 p-3">
          <p className="type-caption text-foreground">
            We couldn&rsquo;t check this right now.{' '}
            {draftStatus === 'saved'
              ? 'Your response is saved and you can keep going.'
              : 'Your response remains here, but it could not be saved for later.'}
          </p>
        </div>
      ) : null}
      {validationMessage ? (
        <p className="type-caption text-destructive" role="alert">
          {validationMessage}
        </p>
      ) : null}
    </>
  );
}

export function WriteEscapeActions({
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
      <Button
        className="w-full text-muted-foreground sm:w-auto"
        onClick={onSkip}
        variant="ghost"
      >
        Skip for now
      </Button>
    );
  }

  if (phase !== 'result' && phase !== 'unavailable') {
    return null;
  }

  return (
    <>
      <Button className="w-full sm:w-auto" onClick={onRevise} variant="outline">
        Revise
      </Button>
      {phase === 'unavailable' ? (
        <Button
          className="w-full sm:w-auto"
          onClick={onContinueUngraded}
          variant="pill"
        >
          Continue ungraded
        </Button>
      ) : null}
    </>
  );
}
