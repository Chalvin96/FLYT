import { useMemo, useState } from 'react';

import type { LessonSummaryRead } from '@/types/api';

import { K_LESSON_STATE } from './constants';
import { findLessonToResume } from './lessonGroups';
import {
  buildLessonLevelOptions,
  normalizeLessonLevel,
  readLessonLevelPreference,
  writeLessonLevelPreference,
} from './lessonLevel';

export type LessonSummary = {
  first: LessonSummaryRead | null;
  resume: LessonSummaryRead | null;
  hasLessons: boolean;
  allLessonsCompleted: boolean;
};

export function summarize(lessons: LessonSummaryRead[]): LessonSummary {
  const first = lessons[0] ?? null;
  const resume = findLessonToResume(lessons);

  return {
    first,
    resume,
    hasLessons: lessons.length > 0,
    allLessonsCompleted:
      lessons.length > 0 &&
      lessons.every((lesson) => lesson.state === K_LESSON_STATE.COMPLETED),
  };
}

/**
 * CEFR level browsing: which levels exist, which one is selected (stored
 * preference when valid, else the resume/first lesson's level), and the
 * lessons visible under the current selection.
 */
export function useLessonLevelSelection(lessons: LessonSummaryRead[]) {
  const summary = summarize(lessons);
  const levelOptions = useMemo(
    () => buildLessonLevelOptions(lessons),
    [lessons],
  );
  const levelCodes = useMemo(
    () => levelOptions.map((option) => option.level),
    [levelOptions],
  );
  const [preferredLevel, setPreferredLevel] = useState(
    readLessonLevelPreference,
  );

  const defaultSource = summary.allLessonsCompleted
    ? summary.first
    : summary.resume;
  const defaultLevel = normalizeLessonLevel(defaultSource?.cefr_level);
  const fallbackLevel =
    defaultLevel && levelCodes.includes(defaultLevel)
      ? defaultLevel
      : (levelCodes[0] ?? null);
  const selectedLevel =
    preferredLevel && levelCodes.includes(preferredLevel)
      ? preferredLevel
      : fallbackLevel;

  const visibleLessons = useMemo(
    () =>
      selectedLevel
        ? lessons.filter(
            (lesson) =>
              normalizeLessonLevel(lesson.cefr_level) === selectedLevel,
          )
        : lessons,
    [lessons, selectedLevel],
  );

  const selectLevel = (level: string) => {
    setPreferredLevel(level);
    writeLessonLevelPreference(level);
  };

  return { levelOptions, selectLevel, selectedLevel, visibleLessons };
}
