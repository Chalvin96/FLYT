import { CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { isAxiosError } from 'axios';

import { Button } from '@/components/common/Button/Button';
import { ErrorMessage } from '@/components/common/ErrorMessage/ErrorMessage';
import { FlashcardSessionCard } from '@/components/flashcard/FlashcardSessionCard';
import type { SessionExerciseResult } from '@/components/flashcard/FlashcardSessionCard';
import type {
  FinishHandler,
  WriteJudgeFn,
} from '@/components/flashcard/operationTypes';
import { K_RATING_GOOD } from '@/lib/fsrsRatings';
import type { QueueCounts } from '@/lib/sessionQueue';
import {
  type ApiErrorResponse,
  type ReviewSubmissionBody,
  type UserCard,
} from '@/types/api';

const K_REVIEW_ERROR_FALLBACK = 'Please try again.';

type SessionStatus = 'card' | 'done' | 'error';

interface ReviewSessionPageProps {
  currentCard?: UserCard;
  status: SessionStatus;
  counts: QueueCounts;
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
  isRetrying?: boolean;
  onRetry?: () => void | Promise<unknown>;
  isSubmitting?: boolean;
  presentationSeq?: number;
  currentCardAhead?: boolean;
  judgeWrite?: WriteJudgeFn;
  submitReview: (args: {
    submission: ReviewSubmissionBody;
  }) => Promise<{ accepted: boolean }>;
}

function getText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function getReviewErrorToastMessage(error: unknown): string {
  if (typeof error === 'string') {
    return getText(error) ?? K_REVIEW_ERROR_FALLBACK;
  }

  if (!isAxiosError<ApiErrorResponse>(error)) {
    return error instanceof Error
      ? (getText(error.message) ?? K_REVIEW_ERROR_FALLBACK)
      : K_REVIEW_ERROR_FALLBACK;
  }

  const detail = error.response?.data?.detail;
  const code = getText(detail?.code);
  const message =
    getText(detail?.message) ??
    getText(detail?.error) ??
    K_REVIEW_ERROR_FALLBACK;

  return code ? `${code} - ${message}` : message;
}

function renderSessionCard(
  card: UserCard,
  isSubmitting: boolean,
  onFinished: FinishHandler<SessionExerciseResult>,
  presentationSeq: number,
  judgeWrite?: WriteJudgeFn,
) {
  return (
    <FlashcardSessionCard
      key={`${card.id}-${presentationSeq}`}
      card={card}
      isSubmitting={isSubmitting}
      judgeWrite={judgeWrite}
      onFinished={onFinished}
    />
  );
}

export function ReviewSessionPage({
  currentCard,
  status,
  counts,
  isLoading = false,
  isError = false,
  error,
  isRetrying = false,
  onRetry,
  isSubmitting = false,
  presentationSeq = 0,
  currentCardAhead = false,
  judgeWrite,
  submitReview,
}: ReviewSessionPageProps) {
  const navigate = useNavigate();
  const [reviewedCount, setReviewedCount] = useState(0);
  const [gradedCount, setGradedCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  const accuracy =
    gradedCount > 0 ? Math.round((correctCount / gradedCount) * 100) : null;

  const isComplete = status === 'done';
  const totalQueued = counts.new + counts.learning + counts.review;

  useEffect(() => {
    if (isLoading) return;
    if (status === 'done' && reviewedCount === 0 && totalQueued === 0) {
      void navigate({ replace: true, search: { mode: 'full' }, to: '/review' });
    }
  }, [isLoading, status, reviewedCount, totalQueued, navigate]);

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
        setReviewedCount((c) => c + 1);
        if (result.kind === 'graded') {
          setGradedCount((c) => c + 1);
          if (result.rating >= K_RATING_GOOD) {
            setCorrectCount((c) => c + 1);
          }
        }
      }
      return res.accepted;
    } catch (error) {
      toast.error(getReviewErrorToastMessage(error));
      return false;
    }
  }

  function handleReturnToReview() {
    void navigate({ search: { mode: 'full' }, to: '/review' });
  }

  if (isLoading) {
    return null;
  }

  if (isError || status === 'error') {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-2xl items-center px-4 py-6">
        <ErrorMessage
          error={getReviewErrorToastMessage(error)}
          title="Could not start review"
          onRetry={onRetry ? () => void onRetry() : undefined}
          retryLabel={isRetrying ? 'Retrying…' : 'Retry'}
        />
      </div>
    );
  }

  if (!currentCard && !isComplete) {
    return null;
  }

  if (isComplete) {
    return (
      <div
        className="container-max mx-auto flex h-full w-full flex-col gap-4 pb-3"
        role="region"
        aria-label="Review session complete"
      >
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <div className="radius-section shadow-raised flex min-h-[28rem] w-full flex-col justify-center border border-border bg-card p-8 text-center md:min-h-[34rem]">
            <div className="flex flex-1 flex-col items-center justify-center">
              <div className="mb-6 flex flex-col items-center gap-3">
                <CheckCircle2 className="size-12 text-primary-70" />
                <h1 className="font-display type-title">Session complete</h1>
              </div>

              <div className="space-y-2">
                <p className="type-body text-foreground">
                  {reviewedCount} card{reviewedCount === 1 ? '' : 's'} reviewed
                </p>
                <p className="type-body text-foreground">
                  {accuracy === null
                    ? 'No graded answers'
                    : `${accuracy}% accuracy`}
                </p>
                {counts.learning > 0 && (
                  <p className="type-caption text-muted-foreground">
                    More cards due later today.
                  </p>
                )}
              </div>
            </div>

            <div className="mx-auto mt-auto w-full max-w-72 pt-8">
              <Button
                type="button"
                className="w-full"
                onClick={() => void handleReturnToReview()}
              >
                Back to review
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full min-h-full w-full max-w-3xl flex-col gap-4 pb-3">
      <div className="flex items-center gap-3">
        <p
          className="type-caption text-muted-foreground"
          data-testid="count-new"
        >
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

      {currentCardAhead && (
        <div className="flex items-center" data-testid="ahead-signal">
          <span className="type-caption inline-flex items-center gap-1.5 rounded-full border border-primary-30 bg-primary-10 px-2.5 py-0.5 text-primary-90">
            Studying ahead
          </span>
        </div>
      )}

      <div className="relative flex min-h-[28rem] flex-1 flex-col md:min-h-[34rem]">
        {renderSessionCard(
          currentCard!,
          isSubmitting,
          handleCardFinished,
          presentationSeq,
          judgeWrite,
        )}

        {isSubmitting && (
          <div className="absolute inset-0 z-20 bg-transparent" />
        )}
      </div>
    </div>
  );
}
