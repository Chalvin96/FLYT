export function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export type CountState = 'under' | 'in-range' | 'over';

export function countState(
  count: number,
  min: number,
  max: number | null,
): CountState {
  if (count < min) return 'under';
  if (max !== null && count > max) return 'over';
  return 'in-range';
}

export function isSubmittable(
  count: number,
  min: number,
  max: number | null,
): boolean {
  return count >= min && (max === null || count <= max);
}
