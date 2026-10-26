import { judgeLessonWrite } from '@/api/lessons';
import {
  buildDraftOwnerKey,
  type ExerciseHostAdapter,
} from '@/components/flashcard/exerciseAdapter';
import type { ReviewSessionState } from '@/hooks/review/useReviewSession';

type ReviewCardSession = Extract<ReviewSessionState, { kind: 'card' }>;

export function buildReviewExerciseAdapter({
  card,
  submitOutcome,
}: Pick<ReviewCardSession, 'card' | 'submitOutcome'>): ExerciseHostAdapter {
  return {
    source: card,
    cardType: card.card.type,
    schemaVersion:
      'schema_version' in card.card ? (card.card.schema_version ?? null) : null,
    allowRetry: false,
    draftOwnerKey: buildDraftOwnerKey({
      userId: card.user_id,
      scope: 'card',
      scopeId: card.id,
    }),
    legacyDraftOwnerKey: `${card.user_id ?? 'anonymous'}-card-${card.id}`,
    findWriteJudge: (exercise) =>
      card.lesson_id == null
        ? undefined
        : (response) =>
            judgeLessonWrite(card.lesson_id ?? 0, exercise.id, response),
    onUnsupported: () => {
      void submitOutcome({ kind: 'ungraded', outcome: 'unsupported' });
    },
  };
}
