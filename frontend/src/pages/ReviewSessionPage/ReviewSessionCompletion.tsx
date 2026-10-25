import { useNavigate } from '@tanstack/react-router';

import { useAddMoreNew, useDueCards } from '@/hooks/review/queries';
import { useStartReviewSession } from '@/hooks/review/useStartReviewSession';
import { startOfNextUtcDay } from '@/lib/sessionQueue';
import { parseUtcTimestamp } from '@/utils/date';

import {
  SessionCompletePanel,
  type ReviewCompletionNextStep,
} from './SessionCompletePanel';

export function ReviewSessionCompletion({
  accuracy,
  reviewedCount,
}: {
  accuracy: number | null;
  reviewedCount: number;
}) {
  const navigate = useNavigate();
  const startReviewSession = useStartReviewSession();
  const dueCards = useDueCards('full', true, {
    refetchOnMount: 'always',
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });
  const { addMoreNew, isPending: isAddMoreNewPending } = useAddMoreNew();

  let nextStep: ReviewCompletionNextStep;
  if (dueCards.isPending || dueCards.fetchStatus !== 'idle') {
    nextStep = { kind: 'loading' };
  } else if (dueCards.isError) {
    nextStep = { kind: 'error', onRetry: () => void dueCards.refetch() };
  } else {
    const nowMs = dueCards.dataUpdatedAt;
    const dayEnd = startOfNextUtcDay(nowMs);
    nextStep = {
      kind: 'ready',
      dueNowCount: dueCards.data.filter(
        (card) => parseUtcTimestamp(card.due_at) <= nowMs,
      ).length,
      hasCardsDueLaterToday: dueCards.data.some((card) => {
        const dueAt = parseUtcTimestamp(card.due_at);
        return (
          (card.state === 'learning' || card.state === 'relearning') &&
          dueAt > nowMs &&
          dueAt < dayEnd
        );
      }),
    };
  }

  return (
    <SessionCompletePanel
      accuracy={accuracy}
      reviewedCount={reviewedCount}
      nextStep={nextStep}
      onContinueReviewing={() => startReviewSession('full')}
      onReturnHome={() => void navigate({ to: '/' })}
      onAddMoreNew={addMoreNew}
      isAddMoreNewPending={isAddMoreNewPending}
    />
  );
}
