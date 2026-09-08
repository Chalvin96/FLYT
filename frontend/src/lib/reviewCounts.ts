import type { UserCard } from '@/types/api';

type ReviewCardCounts = {
  learning: number;
  new: number;
  review: number;
  total: number;
  weak: number;
};

export function getReviewCardCounts(dueCards: UserCard[]): ReviewCardCounts {
  const counts: ReviewCardCounts = {
    learning: 0,
    new: 0,
    review: 0,
    total: dueCards.length,
    weak: 0,
  };

  for (const card of dueCards) {
    if (card.state === 'new') {
      counts.new += 1;
      continue;
    }

    if (card.state === 'learning' || card.state === 'relearning') {
      counts.learning += 1;
      counts.weak += 1;
      continue;
    }

    if (card.state === 'review') {
      counts.review += 1;
    }
  }

  return counts;
}

export type { ReviewCardCounts };
