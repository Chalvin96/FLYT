import { Heading, Text } from '@flyt/ui';

import { useExerciseAttempt } from '@/hooks/flashcard/useExerciseAttempt/useExerciseAttempt';
import type { WriteExercise, WriteJudgement } from '@/types/lesson-contracts';

import { exercisePromptId } from '../flashcard-utils';
import type {
  FinishResult,
  OperationComponentProps,
  WriteJudgeFn,
} from '../operationTypes';
import { CriteriaStrip } from './FlashCardWriteCriteria';
import {
  WriteAlternativeActions,
  WriteEditor,
  WriteNotices,
  WriteTask,
} from './FlashCardWriteEditor';
import { useScrollToCriteriaWhenJudged } from './useScrollToCriteriaWhenJudged';
import { useWriteJudge } from './useWriteJudge';
import { useWriteResponseState } from './useWriteResponseState';
import { countState, countWords, isSubmittable } from './wordCount';
import { WriteOperationShell } from './WriteOperationShell';
import {
  actionHintFor,
  buildWriteCriteriaVerdictsById,
  countCharacters,
  countHintFor,
  draftKey,
  formatCountLabel,
  formatWordBudgetInstruction,
  K_CHAR_COUNTER_VISIBLE_FROM,
  K_MIN_RESPONSE_WORDS_FOR_SUBMISSION,
  K_WRITE_MAX_RESPONSE_CHARS,
  summarizeWriteOutcome,
  type WritePhase,
} from './writeView';

export type { WritePhase };

type FlashCardWriteProps = OperationComponentProps<WriteExercise> & {
  judgeWrite?: WriteJudgeFn;
  draftOwnerKey?: string;
  legacyDraftOwnerKey?: string;
  initialPhase?: WritePhase;
  initialResponse?: string;
  initialJudgement?: WriteJudgement | null;
};

function initialWriteResult(
  criteria: WriteExercise['payload']['criteria'],
  phase: WritePhase,
  judgement: WriteJudgement | null,
) {
  if (phase !== 'result' || !judgement) return null;
  return {
    correct: summarizeWriteOutcome(criteria, judgement)
      .isEveryRequiredCriterionMet,
  };
}

export function FlashCardWrite({
  exercise,
  allowRetry,
  onFinished,
  isSubmitting,
  layout,
  desktopExpanded,
  judgeWrite,
  draftOwnerKey = 'anonymous',
  legacyDraftOwnerKey,
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
  const initialResult = initialWriteResult(
    criteria,
    initialPhase,
    initialJudgement,
  );
  const {
    result,
    reportVerdict,
    reset,
    finish: finishGraded,
    finishUngraded,
  } = useExerciseAttempt({ allowRetry, initialResult, onFinished });

  const { clearDraft, draftStatus, response, updateResponse } =
    useWriteResponseState({
      draftKeyValue: draftKey(draftOwnerKey, exercise.id),
      legacyDraftKeyValue: legacyDraftOwnerKey
        ? draftKey(legacyDraftOwnerKey, exercise.id)
        : undefined,
      initialResponse,
    });
  const { check, judgement, phase, resetToComposing, validationMessage } =
    useWriteJudge({
      initialJudgement,
      initialPhase,
      judgeWrite,
      onJudged: (judgedResponse) =>
        reportVerdict(
          summarizeWriteOutcome(criteria, judgedResponse)
            .isEveryRequiredCriterionMet,
        ),
      response,
    });

  const count = countWords(response);
  const state = countState(count, min, max);
  const characterCount = countCharacters(response);
  const responseTooLong = characterCount > K_WRITE_MAX_RESPONSE_CHARS;
  const submittable = isSubmittable(count, min, max) && !responseTooLong;

  const verdictById = buildWriteCriteriaVerdictsById(judgement);
  const { metRequiredCriteriaCount, requiredCriteriaCount } =
    summarizeWriteOutcome(criteria, judgement);
  const judged = phase === 'result' && judgement !== null;
  const criteriaRef = useScrollToCriteriaWhenJudged(judged);

  async function finishAndClearDraft(
    completion: () => FinishResult | undefined,
  ) {
    let accepted: boolean;
    try {
      accepted = (await completion()) !== false;
    } catch {
      accepted = false;
    }
    if (accepted) clearDraft();
  }

  function handleResponseChange(next: string) {
    updateResponse(next);
    reset();
    resetToComposing();
  }

  function revise() {
    reset();
    resetToComposing();
  }

  function finish() {
    const completion =
      phase === 'result'
        ? finishGraded
        : () => finishUngraded('service_unavailable');
    void finishAndClearDraft(completion);
  }

  function skip() {
    void finishAndClearDraft(() => finishUngraded('skipped'));
  }

  const actionHint = actionHintFor(
    judged,
    metRequiredCriteriaCount,
    requiredCriteriaCount,
    phase,
  );
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
    <WriteOperationShell
      result={result}
      canCheck={submittable && phase === 'composing'}
      desktopExpanded={desktopExpanded}
      alternativeActions={
        <WriteAlternativeActions
          onContinueUngraded={finish}
          onRevise={revise}
          onSkip={skip}
          phase={phase}
        />
      }
      exercise={exercise}
      instruction={instruction}
      isSubmitting={isSubmitting}
      layout={layout}
      onCheck={check}
      onContinue={finish}
      pending={phase === 'pending'}
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
            metRequiredCriteriaCount={metRequiredCriteriaCount}
            requiredCriteriaCount={requiredCriteriaCount}
            judged={judged}
            ref={criteriaRef}
            response={response}
            verdictById={verdictById}
          />
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <Heading as="div" size="xxsmall" tone="brand">
            Your response
          </Heading>
          <Text size="small" tone="subtle">
            Write in Norwegian
          </Text>
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
    </WriteOperationShell>
  );
}
