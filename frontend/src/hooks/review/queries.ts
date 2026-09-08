import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addMoreNew,
  getDueCards,
  listDecks,
  reviewCard,
  subscribeToDeck,
} from '@/api/review';
import { dashboardKeys } from '@/hooks/dashboard/queries';
import type { ReviewResult, ReviewSubmissionBody } from '@/types/api';

export const reviewKeys = {
  dueCards: {
    all: ['due-cards'] as const,
    byMode: (mode: 'quick' | 'full') => ['due-cards', mode] as const,
  },
  decks: {
    all: ['decks'] as const,
  },
};

type DueCardsQueryOptions = {
  refetchOnMount?: boolean;
  refetchOnReconnect?: boolean;
  refetchOnWindowFocus?: boolean;
};

export function useDueCards(
  mode: 'quick' | 'full' = 'full',
  enabled = true,
  options: DueCardsQueryOptions = {},
) {
  return useQuery({
    enabled,
    queryKey: reviewKeys.dueCards.byMode(mode),
    queryFn: () => getDueCards(mode),
    ...options,
  });
}

type ReviewCardData = {
  userCardId: number;
  submission: ReviewSubmissionBody;
  cardId: number;
};

export function useReviewCard() {
  const queryClient = useQueryClient();

  const mutation = useMutation<ReviewResult, Error, ReviewCardData>({
    mutationFn: ({ userCardId, submission, cardId }: ReviewCardData) =>
      reviewCard(userCardId, submission, cardId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: reviewKeys.decks.all }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.stats }),
      ]);
    },
  });

  return {
    isPending: mutation.isPending,
    reviewCard: mutation.mutateAsync,
  };
}

export function useDecks() {
  return useQuery({
    queryKey: reviewKeys.decks.all,
    queryFn: listDecks,
  });
}

export function useSubscribeToDeck() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: subscribeToDeck,
    onSuccess: async () => {
      toast.success('Subscribed! New cards will appear in your review queue.');
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: reviewKeys.decks.all,
        }),
        queryClient.invalidateQueries({
          queryKey: reviewKeys.dueCards.all,
        }),
      ]);
    },
    onError: () => {
      toast.error('Could not subscribe. Please try again.');
    },
  });

  return {
    isPending: mutation.isPending,
    subscribeToDeck: mutation.mutateAsync,
    subscribingDeckId: mutation.variables ?? null,
  };
}

export function useAddMoreNew() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: addMoreNew,
    onSuccess: async ({ promoted }) => {
      if (promoted > 0) {
        toast.success(
          `Added ${promoted} new word${promoted === 1 ? '' : 's'} to your queue.`,
        );
      } else {
        toast.info('No new words available right now.');
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: reviewKeys.dueCards.all }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.stats }),
      ]);
    },
    onError: () => {
      toast.error('Could not add new words. Please try again.');
    },
  });

  return {
    addMoreNew: mutation.mutate,
    isPending: mutation.isPending,
  };
}
