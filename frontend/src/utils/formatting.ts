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

export function formatRelativeDate(isoDate: string): string {
  const targetTime = new Date(isoDate).getTime();
  const now = Date.now();
  const diffMs = targetTime - now;
  const dayMs = 24 * 60 * 60 * 1000;

  const days = Math.round(Math.abs(diffMs) / dayMs);

  if (days === 0) {
    return 'today';
  }

  if (diffMs > 0) {
    return `in ${days} day${days === 1 ? '' : 's'}`;
  }

  return `${days} day${days === 1 ? '' : 's'} ago`;
}
