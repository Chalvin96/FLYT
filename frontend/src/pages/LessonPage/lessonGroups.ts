import type { LessonSummaryRead } from '@/types/api';

import { K_LESSON_STATE } from './constants';

export type LessonGroup = {
  incomplete: LessonSummaryRead[];
  completed: LessonSummaryRead[];
};

function parseActivityTime(lesson: LessonSummaryRead) {
  if (!lesson.last_activity_at) {
    return 0;
  }

  const time = Date.parse(lesson.last_activity_at);
  return Number.isNaN(time) ? 0 : time;
}

export function sortByRecentActivity(lessons: LessonSummaryRead[]) {
  return [...lessons].sort((left, right) => {
    const activityDifference =
      parseActivityTime(right) - parseActivityTime(left);
    return activityDifference || left.order - right.order;
  });
}

export function groupLessons(lessons: LessonSummaryRead[]): LessonGroup {
  const inProgress: LessonSummaryRead[] = [];
  const notStarted: LessonSummaryRead[] = [];
  const completed: LessonSummaryRead[] = [];

  for (const lesson of lessons) {
    if (lesson.state === K_LESSON_STATE.IN_PROGRESS) {
      inProgress.push(lesson);
    } else if (lesson.state === K_LESSON_STATE.NOT_STARTED) {
      notStarted.push(lesson);
    } else {
      completed.push(lesson);
    }
  }

  return {
    incomplete: [...sortByRecentActivity(inProgress), ...notStarted],
    completed,
  };
}

export function findLessonToResume(lessons: LessonSummaryRead[]) {
  const continuing = lessons.filter(
    (lesson) => lesson.state === K_LESSON_STATE.IN_PROGRESS,
  );

  return (
    sortByRecentActivity(continuing)[0] ??
    lessons.find((lesson) => lesson.state === K_LESSON_STATE.NOT_STARTED) ??
    lessons[0] ??
    null
  );
}
