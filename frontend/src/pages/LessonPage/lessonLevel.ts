import type { LessonSummaryRead } from '@/types/api';

import { K_LESSON_STATE } from './constants';

export const LESSON_LEVEL_PREFERENCE_KEY = 'flyt:lesson-page:cefr-level';

const CEFR_LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export interface LessonLevelOption {
  level: string;
  total: number;
  completed: number;
}

export function normalizeLessonLevel(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim().toUpperCase();
  return normalized ? normalized : null;
}

export function buildLessonLevelOptions(
  lessons: LessonSummaryRead[],
): LessonLevelOption[] {
  const counts = new Map<string, LessonLevelOption>();

  for (const lesson of lessons) {
    const level = normalizeLessonLevel(lesson.cefr_level);
    if (!level) {
      continue;
    }

    const current = counts.get(level) ?? { level, total: 0, completed: 0 };
    current.total += 1;
    if (lesson.state === K_LESSON_STATE.COMPLETED) {
      current.completed += 1;
    }
    counts.set(level, current);
  }

  const knownLevels = CEFR_LEVEL_ORDER.filter((level) => counts.has(level));
  const unknownLevels = [...counts.keys()].filter(
    (level) => !CEFR_LEVEL_ORDER.includes(level),
  );

  return [...knownLevels, ...unknownLevels].map((level) => counts.get(level)!);
}

export function readLessonLevelPreference(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return normalizeLessonLevel(
      window.localStorage.getItem(LESSON_LEVEL_PREFERENCE_KEY),
    );
  } catch {
    return null;
  }
}

export function writeLessonLevelPreference(level: string) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(LESSON_LEVEL_PREFERENCE_KEY, level);
  } catch {
    return;
  }
}
