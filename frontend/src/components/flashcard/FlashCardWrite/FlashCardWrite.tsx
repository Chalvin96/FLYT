import { gradedOutcome, type ExerciseOutcome } from '@/lib/operationResult';
import type { WriteExercise, WriteJudgement } from '@/types/lesson-contracts';

import { exercisePromptId } from '../flashcard-utils';
import { OperationShell } from '../OperationShell';
import type { FinishHandler, WriteJudgeFn } from '../operationTypes';
import { CriteriaStrip } from './FlashCardWriteCriteria';
import {
  WriteEditor,
  WriteEscapeActions,
  WriteNotices,
  WriteTask,
} from './FlashCardWriteEditor';
import { useScrollToCriteriaWhenJudged } from './useScrollToCriteriaWhenJudged';
import { useWriteJudge } from './useWriteJudge';
import { useWriteResponseState } from './useWriteResponseState';
import { countState, countWords, isSubmittable } from './wordCount';
import {
  actionHintFor,
  buildWriteCriteriaVerdictsById,
  countCharacters,
  countHintFor,
  countMetCriteria,
  draftKey,
  formatCountLabel,
  formatWordBudgetInstruction,
  K_CHAR_COUNTER_VISIBLE_FROM,
  K_MIN_RESPONSE_WORDS_FOR_SUBMISSION,
  K_WRITE_MAX_RESPONSE_CHARS,
  type WritePhase,
} from './writeView';

export type { WritePhase };

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

  const { clearDraft, draftStatus, response, updateResponse } =
    useWriteResponseState({
      draftKeyValue: draftKey(draftOwnerKey, exercise.id),
      initialResponse,
    });
  const { check, judgement, phase, resetToComposing, validationMessage } =
    useWriteJudge({ initialJudgement, initialPhase, judgeWrite, response });

  const count = countWords(response);
  const state = countState(count, min, max);
  const characterCount = countCharacters(response);
  const responseTooLong = characterCount > K_WRITE_MAX_RESPONSE_CHARS;
  const submittable = isSubmittable(count, min, max) && !responseTooLong;

  const verdictById = buildWriteCriteriaVerdictsById(judgement);
  const metCount = countMetCriteria(judgement);
  const judged = phase === 'result' && judgement !== null;
  const criteriaRef = useScrollToCriteriaWhenJudged(judged);

  async function finishWithOutcome(outcome: ExerciseOutcome) {
    let accepted: boolean;
    try {
      accepted = (await onFinished?.(outcome)) !== false;
    } catch {
      accepted = false;
    }
    if (accepted) clearDraft();
  }

  function handleResponseChange(next: string) {
    updateResponse(next);
    resetToComposing();
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

  const actionHint = actionHintFor(judged, metCount, criteria.length, phase);
  const countHint = countHintFor({
    authoredMax,
    authoredMin,
    count,
    responseTooLong,
    state,
    validationMessage,
  });
  const instruction = hasWordBudget
    ? formatWordBudgetInstruction(authoredMin, authoredMax)
    : undefined;
  const countLabel = hasWordBudget
    ? formatCountLabel(count, authoredMin, authoredMax)
    : null;
  const characterLabel =
    characterCount >= K_CHAR_COUNTER_VISIBLE_FROM
      ? `${characterCount} / ${K_WRITE_MAX_RESPONSE_CHARS}`
      : null;

  return (
    <OperationShell
      canCheck={submittable && phase === 'composing'}
      className={className}
      desktopExpanded={desktopExpanded}
      escapeAction={
        <WriteEscapeActions
          onContinueUngraded={finish}
          onRevise={resetToComposing}
          onSkip={skip}
          phase={phase}
        />
      }
      exercise={exercise}
      fillWorkSurface
      instruction={instruction}
      isSubmitting={isSubmitting}
      naturalHeightOnMobile
      onCheck={check}
      onContinue={finish}
      ownsResultFeedback
      pending={phase === 'pending'}
      pendingLabel="Checking…"
      promptInWorkSurface
      result={judged ? { correct: metCount === criteria.length } : null}
      statusFirstOnMobile
      statusHint={actionHint ?? countHint}
    >
      <div
        className="flex min-h-0 flex-1 flex-col gap-3"
        data-testid="write-surface"
      >
        <WriteTask exercise={exercise} />

        {criteria.length ? (
          <CriteriaStrip
            criteria={criteria}
            judged={judged}
            metCount={metCount}
            ref={criteriaRef}
            response={response}
            verdictById={verdictById}
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

        <WriteEditor
          ariaDescribedBy={
            exercise.prompt.length ? exercisePromptId(exercise.id) : undefined
          }
          characterLabel={characterLabel}
          countLabel={countLabel}
          countState={state}
          disabled={phase === 'pending'}
          draftStatus={draftStatus}
          onChange={handleResponseChange}
          response={response}
          responseTooLong={responseTooLong}
        />

        <WriteNotices
          draftStatus={draftStatus}
          phase={phase}
          validationMessage={validationMessage}
        />
      </div>
    </OperationShell>
  );
}
