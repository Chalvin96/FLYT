export { fadeUp, stagger } from '@/lib/animations';

export const emptySnapshot = {
  this_week: [0, 0, 0, 0, 0, 0, 0],
  last_week: [0, 0, 0, 0, 0, 0, 0],
  two_weeks_ago: [0, 0, 0, 0, 0, 0, 0],
  three_weeks_ago: [0, 0, 0, 0, 0, 0, 0],
};

export const K_HERO_STATE_REVIEW = 'review';
export const K_HERO_STATE_RISK = 'risk';
export const K_HERO_STATE_LESSONS = 'lessons';
export const K_HERO_STATE_DONE = 'done';
export const K_HERO_STATE_EMPTY = 'empty';

export const DAY_LABELS = [
  { short: 'M', long: 'Monday' },
  { short: 'T', long: 'Tuesday' },
  { short: 'W', long: 'Wednesday' },
  { short: 'T', long: 'Thursday' },
  { short: 'F', long: 'Friday' },
  { short: 'S', long: 'Saturday' },
  { short: 'S', long: 'Sunday' },
] as const;

export const CELL_PALETTE = [
  'bg-secondary-10',
  'bg-secondary-20',
  'bg-secondary-40',
  'bg-secondary-60',
  'bg-secondary-80',
  'bg-secondary-100',
] as const;

export function getCellLevel(value: number) {
  if (value <= 0) return 0;
  if (value >= 250) return 5;
  if (value >= 100) return 4;
  if (value >= 50) return 3;
  if (value >= 25) return 2;
  return 1;
}

export function cellClass(level: number) {
  return CELL_PALETTE[level] ?? CELL_PALETTE[0];
}
