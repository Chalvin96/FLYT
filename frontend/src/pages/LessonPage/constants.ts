export const K_LESSON_STATE = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
} as const;

export const K_LESSON_HERO_MODE = {
  NEXT: 'next',
  REVIEW_FIRST: 'review-first',
} as const;

export type LessonHeroMode =
  (typeof K_LESSON_HERO_MODE)[keyof typeof K_LESSON_HERO_MODE];
