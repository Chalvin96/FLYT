import type { UserCard } from '@/types/api';
import type { Exercise, WriteExercise } from '@/types/lesson-contracts';

import type { WriteJudgeFn } from './operationTypes';

export type ExerciseHostAdapter = {
  source: Exercise | UserCard;
  cardType: string;
  schemaVersion: string | null;
  allowRetry: boolean;
  draftOwnerKey: string;
  legacyDraftOwnerKey?: string;
  findWriteJudge: (exercise: WriteExercise) => WriteJudgeFn | undefined;
  onUnsupported: () => void;
};

export function buildDraftOwnerKey({
  userId,
  scope,
  scopeId,
}: {
  userId?: number;
  scope: 'lesson' | 'card';
  scopeId: number;
}): string {
  return `user-${userId ?? 'anonymous'}-${scope}-${scopeId}`;
}
