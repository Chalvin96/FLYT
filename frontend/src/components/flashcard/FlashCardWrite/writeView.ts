import { getApiErrorCode, getApiErrorMessage } from '@/lib/apiError';
import type { WriteJudgement } from '@/types/lesson-contracts';

import type { CountState } from './wordCount';

export type WritePhase = 'composing' | 'pending' | 'result' | 'unavailable';

export const K_MIN_RESPONSE_WORDS_FOR_SUBMISSION = 1;
export const K_WRITE_MAX_RESPONSE_CHARS = 500;
export const K_CHAR_COUNTER_VISIBLE_FROM = 400;
export const K_OBSERVATION_CRITERION_SUFFIX = '-observation';

export function countCharacters(value: string): number {
  return Array.from(value).length;
}

export function draftKey(userUuid: string, exerciseId: string) {
  return `flyt.write.draft.${userUuid}.${exerciseId}`;
}

export function formatWordBudgetInstruction(
  authoredMin: number | null,
  authoredMax: number | null,
): string | undefined {
  if (authoredMin === null) {
    return `Answer in Norwegian, up to ${authoredMax} words.`;
  }
  if (authoredMax === null) {
    return `Answer in Norwegian, at least ${authoredMin} words.`;
  }
  if (authoredMin === authoredMax) {
    return `Answer in Norwegian, ${authoredMin} words.`;
  }
  return `Answer in Norwegian, ${authoredMin}–${authoredMax} words.`;
}

export function formatCountLabel(
  count: number,
  authoredMin: number | null,
  authoredMax: number | null,
): string | null {
  if (authoredMin === null) {
    return `${count} / ≤${authoredMax}`;
  }
  if (authoredMax === null) {
    return `${count} / ${authoredMin}+`;
  }
  return `${count} / ${authoredMin}–${authoredMax}`;
}

export function actionHintFor(
  judged: boolean,
  metRequiredCriteriaCount: number,
  requiredCriteriaCount: number,
  phase: WritePhase,
): string | null {
  if (judged) {
    return metRequiredCriteriaCount === requiredCriteriaCount
      ? 'Continue when you are ready'
      : 'Revise your response or continue';
  }
  return phase === 'unavailable' ? 'Checking is unavailable' : null;
}

export function countHintFor({
  authoredMax,
  authoredMin,
  count,
  responseTooLong,
  state,
  validationMessage,
}: {
  authoredMax: number | null;
  authoredMin: number | null;
  count: number;
  responseTooLong: boolean;
  state: CountState;
  validationMessage: string | null;
}): string {
  if (responseTooLong) {
    return `Response must be ${K_WRITE_MAX_RESPONSE_CHARS} characters or fewer`;
  }
  if (validationMessage) {
    return validationMessage;
  }
  if (state === 'under' && authoredMin !== null) {
    const remaining = authoredMin - count;
    return `${remaining} more word${remaining === 1 ? '' : 's'}`;
  }
  if (state === 'over' && authoredMax !== null) {
    return `${count - authoredMax} over the suggested length`;
  }
  return count === 0 ? 'Write a response' : 'Ready to check';
}

export function isWriteValidationError(error: unknown): boolean {
  if (getApiErrorCode(error) === 'WRITE_RESPONSE_INVALID') {
    return true;
  }
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  return (
    'response' in error &&
    (error as { response?: { status?: number } }).response?.status === 422
  );
}

export function buildWriteValidationMessage(error: unknown): string {
  return getApiErrorCode(error) === 'WRITE_RESPONSE_INVALID'
    ? getApiErrorMessage(error)
    : 'Please correct your response before checking.';
}

export function buildWriteCriteriaVerdictsById(
  judgement: WriteJudgement | null,
): Map<string, WriteJudgement['criteria'][number]> {
  return new Map(
    (judgement?.criteria ?? []).map((verdict) => [
      verdict.criterion_id,
      verdict,
    ]),
  );
}

export function isObservationCriterionId(criterionId: string): boolean {
  return criterionId.endsWith(K_OBSERVATION_CRITERION_SUFFIX);
}

export type WriteOutcomeSummary = {
  metRequiredCriteriaCount: number;
  requiredCriteriaCount: number;
  isEveryRequiredCriterionMet: boolean;
};

export function summarizeWriteOutcome(
  criteria: readonly { id: string }[],
  judgement: WriteJudgement | null,
): WriteOutcomeSummary {
  const metByCriterionId = new Map(
    (judgement?.criteria ?? []).map((verdict) => [
      verdict.criterion_id,
      verdict.met,
    ]),
  );
  let metRequiredCriteriaCount = 0;
  let requiredCriteriaCount = 0;
  for (const criterion of criteria) {
    if (isObservationCriterionId(criterion.id)) continue;
    requiredCriteriaCount += 1;
    if (metByCriterionId.get(criterion.id) === true) {
      metRequiredCriteriaCount += 1;
    }
  }
  return {
    metRequiredCriteriaCount,
    requiredCriteriaCount,
    isEveryRequiredCriterionMet:
      metRequiredCriteriaCount === requiredCriteriaCount,
  };
}
