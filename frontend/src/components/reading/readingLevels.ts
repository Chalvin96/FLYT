export const READING_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

type ReadingLevel = (typeof READING_LEVELS)[number];

const LOWER_LEVELS = new Map<string, ReadingLevel>([
  ['A2', 'A1'],
  ['B1', 'A2'],
  ['B2', 'B1'],
  ['C1', 'B2'],
  ['C2', 'C1'],
]);

export function getLowerReadingLevel(level: string | null) {
  return level === null ? undefined : LOWER_LEVELS.get(level);
}
