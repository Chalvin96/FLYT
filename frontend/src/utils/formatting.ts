import type { CardState } from '@/types/api';

export function formatCardState(state: CardState): string {
  const labels: Record<CardState, string> = {
    new: 'New',
    learning: 'Learning',
    review: 'Review',
    relearning: 'Relearning',
  };

  return labels[state];
}
