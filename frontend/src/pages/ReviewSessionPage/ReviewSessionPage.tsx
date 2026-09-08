import { toast } from 'sonner';
import { Navigate, useNavigate } from '@tanstack/react-router';

import { ErrorMessage } from '@/components/common/ErrorMessage/ErrorMessage';
import { FlashcardSessionCard } from '@/components/flashcard/FlashcardSessionCard';
import type { SessionExerciseResult } from '@/components/flashcard/FlashcardSessionCard';
import type { WriteJudgeFn } from '@/components/flashcard/operationTypes';
import type { QueueCounts } from '@/lib/sessionQueue';
import type { ReviewSubmissionBody, UserCard } from '@/types/api';

import { getReviewErrorToastMessage } from './reviewSessionErrors';
import {
  IDLE_LOAD_STATE,
  type ReviewSessionLoadState,
} from './reviewSessionLoadState';
import { SessionCompletePanel } from './SessionCompletePanel';
import { useSessionStats } from './useSessionStats';

type SessionStatus = 'card' | 'done' | 'error';

export type { ReviewSessionLoadState };

interface ReviewSessionPageProps {
  currentCard?: UserCard;
  status: SessionStatus;
  counts: QueueCounts;
  loadState?: ReviewSessionLoadState;
  error?: unknown;
  onRetry?: () => void | Promise<unknown>;
  isSubmitting?: boolean;
  presentationSeq?: number;
  currentCardAhead?: boolean;
  judgeWrite?: WriteJudgeFn;
  submitReview: (args: {
    submission: ReviewSubmissionBody;
  }) => Promise<{ accepted: boolean }>;
}

export function ReviewSessionPage({
  currentCard,
  status,
  counts,
  loadState = IDLE_LOAD_STATE,
  error,
  onRetry,
  isSubmitting = false,
  presentationSeq = 0,
  currentCardAhead = false,
  judgeWrite,
  submitReview,
}: ReviewSessionPageProps) {
  const navigate = useNavigate();
  const { accuracy, recordAcceptedResult, reviewedCount } = useSessionStats();

  const isComplete = status === 'done';
  const totalQueued = counts.new + counts.learning + counts.review;

  async function handleCardFinished(
    result: SessionExerciseResult,
  ): Promise<boolean> {
    if (!currentCard || isSubmitting) {
      return false;
    }

    try {
      const res = await submitReview({
        submission:
          result.kind === 'graded'
            ? { outcome: 'graded', rating: result.rating }
            : { outcome: result.outcome },
      });

      if (res.accepted) {
        recordAcceptedResult(result);
      }
      return res.accepted;
    } catch (error) {
      toast.error(getReviewErrorToastMessage(error));
      return false;
    }
  }

  if (loadState.isLoading) {
    return null;
  }

  if (status === 'done' && reviewedCount === 0 && totalQueued === 0) {
    return <Navigate replace search={{ mode: 'full' }} to="/review" />;
  }

  if (loadState.isError || status === 'error') {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-2xl items-center px-4 py-6">
        <ErrorMessage
          error={getReviewErrorToastMessage(error)}
          title="Could not start review"
          onRetry={onRetry ? () => void onRetry() : undefined}
          retryLabel={loadState.isRetrying ? 'Retrying…' : 'Retry'}
        />
      </div>
    );
  }

  if (!currentCard && !isComplete) {
    return null;
  }

  if (isComplete) {
    return (
      <SessionCompletePanel
        accuracy={accuracy}
        hasCardsDueLaterToday={counts.learning > 0}
        onReturnToReview={() =>
          void navigate({ search: { mode: 'full' }, to: '/review' })
        }
        reviewedCount={reviewedCount}
      />
    );
  }

  if (!currentCard) {
    return null;
  }

  return (
    <div className="mx-auto flex h-full min-h-full w-full max-w-3xl flex-col gap-4 pb-3">
      <SessionCountsBar counts={counts} />

      {currentCardAhead ? (
        <div className="flex items-center" data-testid="ahead-signal">
          <span className="type-caption inline-flex items-center gap-1.5 rounded-full border border-primary-30 bg-primary-10 px-2.5 py-0.5 text-primary-90">
            Studying ahead
          </span>
        </div>
      ) : null}

      <div className="relative flex min-h-[28rem] flex-1 flex-col md:min-h-[34rem]">
        <FlashcardSessionCard
          card={currentCard}
          isSubmitting={isSubmitting}
          judgeWrite={judgeWrite}
          key={`${currentCard.id}-${presentationSeq}`}
          onFinished={handleCardFinished}
        />

        {isSubmitting ? (
          <div className="absolute inset-0 z-20 bg-transparent" />
        ) : null}
      </div>
    </div>
  );
}

function SessionCountsBar({ counts }: { counts: QueueCounts }) {
  return (
    <div className="flex items-center gap-3">
      <p className="type-caption text-muted-foreground" data-testid="count-new">
        {counts.new} new
      </p>
      <span className="type-caption text-muted-foreground">·</span>
      <p
        className="type-caption text-muted-foreground"
        data-testid="count-learning"
      >
        {counts.learning} learning
      </p>
      <span className="type-caption text-muted-foreground">·</span>
      <p
        className="type-caption text-muted-foreground"
        data-testid="count-review"
      >
        {counts.review} review
      </p>
      <div className="flex-1" />
    </div>
  );
}
