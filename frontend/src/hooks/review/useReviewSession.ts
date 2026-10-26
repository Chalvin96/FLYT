import { toast } from 'sonner';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { dashboardKeys } from '@/hooks/dashboard/queries';
import { reviewKeys, useDueCards, useReviewCard } from '@/hooks/review/queries';
import type { ExerciseOutcome } from '@/lib/operationResult';
import {
  applyReview,
  buildQueue,
  counts as countQueue,
  showNext,
  type QueueCounts,
  type SessionQueue,
} from '@/lib/sessionQueue';
import type { ReviewSubmissionBody, UserCard } from '@/types/api';

import { getReviewErrorToastMessage } from './reviewSessionErrors';

type SessionSummary = {
  reviewedCount: number;
  accuracy: number | null;
};

export type ReviewSessionState =
  | { kind: 'loading' }
  | {
      kind: 'error';
      message: string;
      isRetrying: boolean;
      retry: () => Promise<unknown>;
    }
  | { kind: 'empty' }
  | {
      kind: 'complete';
      counts: QueueCounts;
      summary: SessionSummary;
    }
  | {
      kind: 'card';
      card: UserCard;
      presentationKey: string;
      ahead: boolean;
      counts: QueueCounts;
      summary: SessionSummary;
      isSubmitting: boolean;
      submitOutcome: (outcome: ExerciseOutcome) => Promise<boolean>;
    };

function submissionFromOutcome(
  outcome: ExerciseOutcome,
  reviewVersion: number,
): ReviewSubmissionBody {
  return outcome.kind === 'graded'
    ? {
        outcome: 'graded',
        rating: outcome.rating,
        review_version: reviewVersion,
      }
    : { outcome: outcome.outcome, review_version: reviewVersion };
}

export function useReviewSession(mode: 'quick' | 'full'): ReviewSessionState {
  const queryClient = useQueryClient();
  const { data, error, isError, isFetching, refetch } = useDueCards(
    mode,
    true,
    {
      refetchOnMount: 'always',
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
    },
  );
  const { reviewCard } = useReviewCard();

  const [queue, setQueue] = useState<SessionQueue>();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [lastShownUserCardId, setLastShownUserCardId] = useState<number>();
  const [reviewedCount, setReviewedCount] = useState(0);
  const [gradedCount, setGradedCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [presentationSeq, setPresentationSeq] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inFlightRef = useRef(false);

  if (queue === undefined && data !== undefined && !isFetching) {
    setQueue(buildQueue(data));
  }

  const next =
    queue === undefined
      ? undefined
      : showNext(queue, nowMs, lastShownUserCardId);
  const currentCard = next?.kind === 'card' ? next.card : undefined;

  const submitOutcome = useCallback(
    async (outcome: ExerciseOutcome): Promise<boolean> => {
      if (inFlightRef.current || currentCard === undefined) return false;

      const submission = submissionFromOutcome(
        outcome,
        currentCard.review_version,
      );
      inFlightRef.current = true;
      setIsSubmitting(true);
      try {
        const result = await reviewCard({
          userCardId: currentCard.id,
          submission,
          cardId: currentCard.card.id,
        });

        const reviewedAt = Date.now();
        setNowMs(reviewedAt);
        setQueue((currentQueue) => {
          if (currentQueue === undefined) return currentQueue;
          if (submission.outcome !== 'graded') {
            const remaining = new Map(currentQueue.cards);
            remaining.delete(currentCard.id);
            return { cards: remaining };
          }
          return applyReview(currentQueue, currentCard.id, result, reviewedAt);
        });
        setLastShownUserCardId(currentCard.id);
        setPresentationSeq((sequence) => sequence + 1);
        setReviewedCount((count) => count + 1);
        if (outcome.kind === 'graded') {
          setGradedCount((count) => count + 1);
          if (outcome.correct) setCorrectCount((count) => count + 1);
        }
        return true;
      } catch (error) {
        toast.error(getReviewErrorToastMessage(error));
        return false;
      } finally {
        inFlightRef.current = false;
        setIsSubmitting(false);
      }
    },
    [currentCard, reviewCard],
  );

  useEffect(
    () => () => {
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: reviewKeys.dueCards.all,
          refetchType: 'none',
        }),
        queryClient.invalidateQueries({ queryKey: reviewKeys.decks.all }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.stats }),
      ]);
    },
    [queryClient],
  );

  if (isError && queue === undefined) {
    return {
      kind: 'error',
      message: getReviewErrorToastMessage(error),
      isRetrying: isFetching,
      retry: refetch,
    };
  }

  if (queue === undefined || next === undefined) return { kind: 'loading' };

  const counts = countQueue(queue);
  const summary = {
    reviewedCount,
    accuracy:
      gradedCount > 0 ? Math.round((correctCount / gradedCount) * 100) : null,
  };

  if (next.kind === 'done') {
    if (reviewedCount === 0 && queue.cards.size === 0) {
      return { kind: 'empty' };
    }
    return {
      kind: 'complete',
      counts,
      summary,
    };
  }

  return {
    kind: 'card',
    card: next.card,
    presentationKey: `${next.card.id}-${presentationSeq}`,
    ahead: next.ahead,
    counts,
    summary,
    isSubmitting,
    submitOutcome,
  };
}
