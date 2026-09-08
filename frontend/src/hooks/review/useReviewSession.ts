import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { dashboardKeys } from '@/hooks/dashboard/queries';
import { reviewKeys, useDueCards, useReviewCard } from '@/hooks/review/queries';
import {
  applyReview,
  buildQueue,
  counts as countQueue,
  showNext,
  type QueueCounts,
  type SessionQueue,
} from '@/lib/sessionQueue';
import type { ReviewSubmissionBody, UserCard } from '@/types/api';

type SessionStatus = 'card' | 'done' | 'error';

interface UseReviewSessionResult {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  isRetrying: boolean;
  retry: () => Promise<unknown>;
  currentCard: UserCard | undefined;
  status: SessionStatus;
  counts: QueueCounts;
  isSubmitting: boolean;
  presentationSeq: number;
  currentCardAhead: boolean;
  submitReview: (args: {
    submission: ReviewSubmissionBody;
  }) => Promise<{ accepted: boolean }>;
}

export function useReviewSession(
  mode: 'quick' | 'full',
): UseReviewSessionResult {
  const queryClient = useQueryClient();
  const { data, error, isError, isFetching, isPending, refetch } = useDueCards(
    mode,
    true,
    {
      refetchOnMount: true,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
    },
  );
  const { reviewCard } = useReviewCard();

  const [queue, setQueue] = useState<SessionQueue | undefined>(undefined);

  if (queue === undefined && data !== undefined && !isFetching) {
    setQueue(buildQueue(data));
  }

  const [nowMs, setNowMs] = useState(() => Date.now());

  const [lastShownUserCardId, setLastShownUserCardId] = useState<
    number | undefined
  >(undefined);

  const inFlightRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [presentationSeq, setPresentationSeq] = useState(0);

  const next =
    queue !== undefined
      ? showNext(queue, nowMs, lastShownUserCardId)
      : undefined;

  const currentCard = next?.kind === 'card' ? next.card : undefined;
  const status: SessionStatus =
    isError && queue === undefined ? 'error' : (next?.kind ?? 'done');
  const currentCardAhead = next?.kind === 'card' ? next.ahead : false;
  const currentCounts =
    queue !== undefined
      ? countQueue(queue)
      : { new: 0, learning: 0, review: 0 };

  const submitReview = useCallback(
    async ({
      submission,
    }: {
      submission: ReviewSubmissionBody;
    }): Promise<{ accepted: boolean }> => {
      if (inFlightRef.current) return { accepted: false };
      const card = currentCard;
      if (card === undefined) return { accepted: false };

      inFlightRef.current = true;
      setIsSubmitting(true);
      try {
        const res = await reviewCard({
          userCardId: card.id,
          submission,
          cardId: card.card.id,
        });

        const reviewedAt = Date.now();
        setNowMs(reviewedAt);
        setQueue((q) => {
          if (q === undefined) return q;
          if (submission.outcome !== 'graded') {
            const next = new Map(q.cards);
            next.delete(card.id);
            return { cards: next };
          }
          return applyReview(
            q,
            card.id,
            res.card_state,
            Date.parse(res.due_at),
            reviewedAt,
          );
        });
        setLastShownUserCardId(card.id);
        setPresentationSeq((n) => n + 1);
        return { accepted: true };
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
        queryClient.invalidateQueries({ queryKey: reviewKeys.dueCards.all }),
        queryClient.invalidateQueries({ queryKey: reviewKeys.decks.all }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.stats }),
      ]);
    },
    [queryClient],
  );

  return {
    isLoading: isPending && queue === undefined,
    isError: isError && queue === undefined,
    error,
    isRetrying: isFetching && !isPending,
    retry: refetch,
    currentCard,
    status,
    counts: currentCounts,
    isSubmitting,
    presentationSeq,
    currentCardAhead,
    submitReview,
  };
}
