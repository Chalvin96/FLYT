import { Check, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type Ref } from 'react';

import { Button } from '@/components/common/Button/Button';
import { SpanView } from '@/components/portable/SpanView';
import { getApiErrorCode, getApiErrorMessage } from '@/lib/apiError';
import { gradedOutcome, type ExerciseOutcome } from '@/lib/operationResult';
import { cn } from '@/lib/utils';
import type { WriteExercise, WriteJudgement } from '@/types/lesson-contracts';

import { exercisePromptId, spanPlainText } from '../flashcard-utils';
import { withOperationTimeout } from '../operationRequest';
import { OperationShell } from '../OperationShell';
import type { FinishHandler, WriteJudgeFn } from '../operationTypes';
import { readDraft, removeDraft, saveDraft } from './draftStorage';
import { countState, countWords, isSubmittable } from './wordCount';

export type WritePhase = 'composing' | 'pending' | 'result' | 'unavailable';
type DraftStatus = 'saved' | 'unavailable';

type FlashCardWriteProps = {
  exercise: WriteExercise;
  onFinished?: FinishHandler<ExerciseOutcome>;
  isSubmitting?: boolean;
  className?: string;
  desktopExpanded?: boolean;
  judgeWrite?: WriteJudgeFn;
  draftOwnerKey?: string;
  initialPhase?: WritePhase;
  initialResponse?: string;
  initialJudgement?: WriteJudgement | null;
};

const K_MIN_RESPONSE_WORDS_FOR_SUBMISSION = 1;
export const K_WRITE_MAX_RESPONSE_CHARS = 500;
const K_CHAR_COUNTER_VISIBLE_FROM = 400;
const K_WRITE_TASK_CLAMP_CHARS = 180;

function countCharacters(value: string): number {
  return Array.from(value).length;
}

function draftKey(userUuid: string, exerciseId: string) {
  return `flyt.write.draft.${userUuid}.${exerciseId}`;
}

type Criterion = WriteExercise['payload']['criteria'][number];
type Verdict = WriteJudgement['criteria'][number];

function CriterionMarker({
  index,
  verdict,
}: {
  index: number;
  verdict: Verdict | undefined;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'type-label-xs mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border',
        verdict
          ? verdict.met
            ? 'border-accent-20 bg-accent-0 text-accent-90'
            : 'border-destructive-20 bg-destructive-0 text-destructive-80'
          : 'border-border bg-card text-muted-foreground',
      )}
    >
      {verdict ? (
        verdict.met ? (
          <Check className="size-3" />
        ) : (
          <X className="size-3" />
        )
      ) : (
        index + 1
      )}
    </span>
  );
}

function normalizeForComparison(value: string): string {
  return value
    .toLocaleLowerCase('no')
    .replace(/[«»"“”„'’]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasAdditionalEvidence(
  evidence: string,
  response: string,
  met: boolean,
): boolean {
  const quote = normalizeForComparison(evidence);
  const written = normalizeForComparison(response);
  if (!quote) return false;
  return met ? !written.includes(quote) : quote !== written;
}

function criteriaSummary(
  judged: boolean,
  metCount: number,
  total: number,
): string {
  if (!judged) return 'What gets checked';
  if (metCount === total) return 'All criteria met';
  return `${metCount} of ${total} criteria met`;
}

function CriteriaStrip({
  criteria,
  verdictById,
  judged,
  metCount,
  response,
  ref,
}: {
  criteria: Criterion[];
  verdictById: Map<string, Verdict>;
  judged: boolean;
  metCount: number;
  response: string;
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <div ref={ref} data-testid="write-criteria" className="flex flex-col gap-2">
      <p role="status" data-testid="write-criteria-summary" className="sr-only">
        {criteriaSummary(judged, metCount, criteria.length)}
      </p>
      <ul role="list" className="grid gap-2 sm:grid-cols-2">
        {criteria.map((criterion, index) => {
          const verdict = judged ? verdictById.get(criterion.id) : undefined;
          const evidence = verdict?.evidence?.trim();
          const showEvidence =
            verdict &&
            evidence &&
            hasAdditionalEvidence(evidence, response, verdict.met);
          return (
            <li key={criterion.id} className="min-w-0">
              <div
                className={cn(
                  'radius-field flex h-full items-start gap-2 border p-3',
                  judged && verdict?.met
                    ? 'border-accent-20 bg-accent-0'
                    : judged && verdict
                      ? 'border-destructive-20 bg-destructive-0'
                      : 'border-border bg-card/60',
                )}
              >
                <CriterionMarker index={index} verdict={verdict} />
                <div className="min-w-0 flex-1">
                  <p className="type-caption text-muted-foreground">
                    {criterion.instruction}
                    {verdict ? (
                      <span className="sr-only">
                        {verdict.met ? ' — met' : ' — not met'}
                      </span>
                    ) : null}
                  </p>
                  {showEvidence ? (
                    <p
                      lang="no"
                      className="type-caption-sm mt-1 line-clamp-2 border-l-2 border-border pl-2 text-muted-foreground italic"
                    >
                      &ldquo;{evidence}&rdquo;
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function WriteTask({ exercise }: { exercise: WriteExercise }) {
  const [expanded, setExpanded] = useState(false);
  if (!exercise.prompt.length) return null;

  const promptId = exercisePromptId(exercise.id);
  const clampable =
    spanPlainText(exercise.prompt).length > K_WRITE_TASK_CLAMP_CHARS;

  return (
    <div
      data-testid="write-task"
      className="radius-field border border-border bg-secondary-5 p-4"
    >
      <p className="font-display type-label leading-flat text-muted-foreground">
        Task
      </p>
      <p
        id={promptId}
        data-testid="exercise-prompt"
        className={cn(
          'type-caption mt-2 text-foreground text-pretty sm:type-body',
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
          className="type-label-xs mt-2 self-start text-muted-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:hidden"
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

export function FlashCardWrite({
  exercise,
  onFinished,
  isSubmitting,
  className,
  desktopExpanded,
  judgeWrite,
  draftOwnerKey = 'anonymous',
  initialPhase = 'composing',
  initialResponse,
  initialJudgement = null,
}: FlashCardWriteProps) {
  const { criteria } = exercise.payload;
  const authoredMin = exercise.payload.min_words ?? null;
  const authoredMax = exercise.payload.max_words ?? null;
  const hasWordBudget = authoredMin !== null || authoredMax !== null;
  const min = authoredMin ?? K_MIN_RESPONSE_WORDS_FOR_SUBMISSION;
  const max = authoredMax;
  const currentDraftKey = draftKey(draftOwnerKey, exercise.id);

  const [response, setResponse] = useState(
    () => initialResponse ?? readDraft(currentDraftKey) ?? '',
  );
  const [draftStatus, setDraftStatus] = useState<DraftStatus | null>(() =>
    initialResponse === undefined && readDraft(currentDraftKey) !== null
      ? 'saved'
      : null,
  );
  const [phase, setPhase] = useState<WritePhase>(initialPhase);
  const [judgement, setJudgement] = useState<WriteJudgement | null>(
    initialJudgement,
  );
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const judgeAttemptRef = useRef(0);

  useEffect(() => {
    if (initialResponse === undefined) return;
    if (initialResponse.trim()) {
      saveDraft(currentDraftKey, initialResponse);
    } else {
      removeDraft(currentDraftKey);
    }
  }, [currentDraftKey, initialResponse]);

  useEffect(
    () => () => {
      judgeAttemptRef.current += 1;
    },
    [],
  );

  const count = countWords(response);
  const state = countState(count, min, max);
  const characterCount = countCharacters(response);
  const responseTooLong = characterCount > K_WRITE_MAX_RESPONSE_CHARS;
  const submittable = isSubmittable(count, min, max) && !responseTooLong;

  const verdictById = useMemo(
    () =>
      new Map(
        (judgement?.criteria ?? []).map((verdict) => [
          verdict.criterion_id,
          verdict,
        ]),
      ),
    [judgement],
  );

  const metCount = (judgement?.criteria ?? []).filter((v) => v.met).length;
  const judged = phase === 'result' && judgement !== null;
  const criteriaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (judged) criteriaRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [judged]);

  function check() {
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
        const apiCode = getApiErrorCode(error);
        const isValidationError =
          apiCode === 'WRITE_RESPONSE_INVALID' ||
          (error &&
            typeof error === 'object' &&
            'response' in error &&
            (error as { response?: { status?: number } }).response?.status ===
              422);
        if (isValidationError) {
          setValidationMessage(
            apiCode === 'WRITE_RESPONSE_INVALID'
              ? getApiErrorMessage(error)
              : 'Please correct your response before checking.',
          );
          setPhase('composing');
          return;
        }
        setPhase('unavailable');
      });
  }

  function clearDraft() {
    setDraftStatus(
      removeDraft(currentDraftKey) === 'removed' ? null : 'unavailable',
    );
  }

  async function finishWithOutcome(outcome: ExerciseOutcome) {
    let accepted: boolean;
    try {
      accepted = (await onFinished?.(outcome)) !== false;
    } catch {
      accepted = false;
    }
    if (accepted) clearDraft();
  }

  function finish() {
    if (phase === 'result' && judgement) {
      void finishWithOutcome(
        gradedOutcome({ correct: metCount === criteria.length }),
      );
      return;
    }
    void finishWithOutcome({
      kind: 'ungraded',
      outcome: 'service_unavailable',
    });
  }

  function skip() {
    void finishWithOutcome({ kind: 'ungraded', outcome: 'skipped' });
  }

  const actionHint = judged
    ? metCount === criteria.length
      ? 'Continue when you are ready'
      : 'Revise your response or continue'
    : phase === 'unavailable'
      ? 'Checking is unavailable'
      : null;
  const countHint = responseTooLong
    ? `Response must be ${K_WRITE_MAX_RESPONSE_CHARS} characters or fewer`
    : (validationMessage ??
      (state === 'under' && authoredMin !== null
        ? `${authoredMin - count} more word${authoredMin - count === 1 ? '' : 's'}`
        : state === 'over' && authoredMax !== null
          ? `${count - authoredMax} over the suggested length`
          : count === 0
            ? 'Write a response'
            : 'Ready to check'));
  const instruction = !hasWordBudget
    ? undefined
    : authoredMin === null
      ? `Answer in Norwegian, up to ${authoredMax} words.`
      : authoredMax === null
        ? `Answer in Norwegian, at least ${authoredMin} words.`
        : authoredMin === authoredMax
          ? `Answer in Norwegian, ${authoredMin} words.`
          : `Answer in Norwegian, ${authoredMin}–${authoredMax} words.`;
  const countLabel = !hasWordBudget
    ? null
    : authoredMin === null
      ? `${count} / ≤${authoredMax}`
      : authoredMax === null
        ? `${count} / ${authoredMin}+`
        : `${count} / ${authoredMin}–${authoredMax}`;
  const characterLabel =
    characterCount >= K_CHAR_COUNTER_VISIBLE_FROM
      ? `${characterCount} / ${K_WRITE_MAX_RESPONSE_CHARS}`
      : null;

  return (
    <OperationShell
      exercise={exercise}
      className={className}
      desktopExpanded={desktopExpanded}
      isSubmitting={isSubmitting}
      instruction={instruction}
      promptInWorkSurface
      fillWorkSurface
      ownsResultFeedback
      statusFirstOnMobile
      naturalHeightOnMobile
      canCheck={submittable && phase === 'composing'}
      pending={phase === 'pending'}
      pendingLabel="Checking…"
      statusHint={actionHint ?? countHint}
      result={judged ? { correct: metCount === criteria.length } : null}
      escapeAction={
        phase === 'composing' ? (
          <Button
            variant="ghost"
            className="w-full text-muted-foreground sm:w-auto"
            onClick={skip}
          >
            Skip for now
          </Button>
        ) : phase === 'result' || phase === 'unavailable' ? (
          <>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setPhase('composing')}
            >
              Revise
            </Button>
            {phase === 'unavailable' ? (
              <Button
                variant="pill"
                className="w-full sm:w-auto"
                onClick={finish}
              >
                Continue ungraded
              </Button>
            ) : null}
          </>
        ) : null
      }
      onCheck={check}
      onContinue={finish}
    >
      <div
        data-testid="write-surface"
        className="flex min-h-0 flex-1 flex-col gap-3"
      >
        <WriteTask exercise={exercise} />

        {criteria.length ? (
          <CriteriaStrip
            ref={criteriaRef}
            criteria={criteria}
            verdictById={verdictById}
            judged={judged}
            metCount={metCount}
            response={response}
          />
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <p className="font-display type-label leading-flat text-primary-80">
            Your response
          </p>
          <p className="type-caption-sm text-muted-foreground">
            Write in Norwegian
          </p>
        </div>

        <div
          data-testid="write-editor"
          className={cn(
            'radius-field shadow-tile flex min-h-48 flex-1 flex-col overflow-hidden border bg-card transition-colors',
            'focus-within:ring-2 focus-within:ring-ring',
            responseTooLong ? 'border-destructive-20' : 'border-border',
            phase === 'pending' && 'opacity-60',
          )}
        >
          <textarea
            lang="no"
            spellCheck={false}
            value={response}
            disabled={phase === 'pending'}
            onChange={(event) => {
              judgeAttemptRef.current += 1;
              const nextResponse = event.target.value;
              setResponse(nextResponse);
              if (nextResponse.trim()) {
                setDraftStatus(saveDraft(currentDraftKey, nextResponse));
              } else {
                setDraftStatus(
                  removeDraft(currentDraftKey) === 'removed'
                    ? null
                    : 'unavailable',
                );
              }
              if (phase !== 'composing') setPhase('composing');
              if (judgement) setJudgement(null);
              setValidationMessage(null);
            }}
            aria-label="Your response in Norwegian"
            aria-describedby={
              exercise.prompt.length ? exercisePromptId(exercise.id) : undefined
            }
            placeholder="Skriv svaret ditt her…"
            className="type-body min-h-28 w-full flex-1 resize-none bg-transparent px-4 py-3 leading-roomy text-foreground placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed"
          />
          <div
            data-testid="write-editor-status"
            className="flex items-center justify-between gap-3 px-4 py-2"
          >
            {draftStatus ? (
              <p
                className={cn(
                  'type-label-xs',
                  draftStatus === 'saved'
                    ? 'text-accent-80'
                    : 'text-warning-60',
                )}
                role="status"
              >
                {draftStatus === 'saved'
                  ? 'Draft saved on this device'
                  : 'Draft not saved'}
              </p>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-3">
              {countLabel ? (
                <p
                  className={cn(
                    'type-caption-sm',
                    state === 'under' && 'text-muted-foreground',
                    state === 'in-range' && 'text-accent-80',
                    state === 'over' && 'text-warning-60',
                  )}
                  aria-live="polite"
                >
                  {countLabel}
                </p>
              ) : null}
              {characterLabel ? (
                <p
                  className={cn(
                    'type-caption-sm',
                    responseTooLong
                      ? 'text-destructive'
                      : 'text-muted-foreground',
                  )}
                >
                  {characterLabel}
                </p>
              ) : null}
            </div>
          </div>
        </div>

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
          <p role="alert" className="type-caption text-destructive">
            {validationMessage}
          </p>
        ) : null}
      </div>
    </OperationShell>
  );
}
