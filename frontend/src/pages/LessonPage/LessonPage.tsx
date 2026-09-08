import { ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';

import { AppCard } from '@/components/common/AppCard/AppCard';
import { Button } from '@/components/common/Button/Button';
import { Skeleton } from '@/components/ui/skeleton';
import type { LessonSummaryRead } from '@/types/api';

import { K_LESSON_HERO_MODE, K_LESSON_STATE } from './constants';
import { LessonEmptyState } from './LessonEmptyState';
import { findLessonToResume, groupLessons } from './lessonGroups';
import { LessonHero, type LessonHeroMode } from './LessonHero';
import {
  buildLessonLevelOptions,
  normalizeLessonLevel,
  readLessonLevelPreference,
  writeLessonLevelPreference,
} from './lessonLevel';
import { LessonLevelSelector } from './LessonLevelSelector';
import { LessonListItem } from './LessonListItem';

type LessonPageProps = {
  lessons?: LessonSummaryRead[];
  isError?: boolean;
  isLoading?: boolean;
  onRetry?: () => void | Promise<unknown>;
};

const GLOBAL_EMPTY_STATE = (
  <LessonEmptyState
    title="No lessons yet"
    description="New lessons will appear here as soon as they are available."
  />
);
const EMPTY_LESSONS: LessonSummaryRead[] = [];

type LessonSummary = {
  first: LessonSummaryRead | null;
  resume: LessonSummaryRead | null;
  hasLessons: boolean;
  allLessonsCompleted: boolean;
};

function summarize(lessons: LessonSummaryRead[]): LessonSummary {
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

function LessonGroupList({ lessons }: { lessons: LessonSummaryRead[] }) {
  return (
    <AppCard className="overflow-hidden p-0">
      <div className="w-full divide-y divide-border/70">
        {lessons.map((lesson) => (
          <LessonListItem key={lesson.id} lesson={lesson} />
        ))}
      </div>
    </AppCard>
  );
}

function LessonGroupSection({
  title,
  lessons,
}: {
  title: string;
  lessons: LessonSummaryRead[];
}) {
  if (lessons.length === 0) {
    return null;
  }

  const headingId = `lesson-group-${title.toLowerCase().replaceAll(' ', '-')}`;

  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <div className="px-1">
        <h2
          id={headingId}
          className="type-section font-semibold text-foreground"
        >
          {title}
        </h2>
      </div>
      <LessonGroupList lessons={lessons} />
    </section>
  );
}

function CompletedLessonGroup({ lessons }: { lessons: LessonSummaryRead[] }) {
  if (lessons.length === 0) {
    return null;
  }

  return (
    <details
      data-testid="completed-lessons"
      className="group overflow-hidden radius-section border border-border bg-card shadow-raised"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
        <h2 className="type-section font-semibold text-foreground">
          Completed · {lessons.length}
        </h2>
        <ChevronDown
          aria-hidden
          className="icon-md text-muted-foreground transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="border-t border-border">
        <div className="divide-y divide-border/70">
          {lessons.map((lesson) => (
            <LessonListItem key={lesson.id} lesson={lesson} />
          ))}
        </div>
      </div>
    </details>
  );
}

export function LessonPage({
  lessons = EMPTY_LESSONS,
  isError = false,
  isLoading = false,
  onRetry,
}: LessonPageProps) {
  const summary = summarize(lessons);
  const levelOptions = useMemo(
    () => buildLessonLevelOptions(lessons),
    [lessons],
  );
  const levelCodes = levelOptions.map((option) => option.level);
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
  const visibleLessons = selectedLevel
    ? lessons.filter(
        (lesson) => normalizeLessonLevel(lesson.cefr_level) === selectedLevel,
      )
    : lessons;
  const visibleGroups = groupLessons(visibleLessons);
  const visibleSummary = summarize(visibleLessons);
  const source = visibleSummary.allLessonsCompleted
    ? visibleSummary.first
    : visibleSummary.resume;
  const heroCompletedCount = visibleLessons.filter(
    (lesson) => lesson.state === K_LESSON_STATE.COMPLETED,
  ).length;

  if (isLoading) {
    return (
      <div
        aria-busy="true"
        className="container-max mx-auto flex w-full flex-col space-y-4 pb-4 sm:space-y-5 lg:pb-6"
        data-testid="lesson-page"
        role="status"
      >
        <span className="sr-only">Loading lessons.</span>
        <Skeleton className="radius-section h-40 w-full" />
        <Skeleton className="radius-section h-20 w-full" />
        <Skeleton className="radius-section h-48 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <LessonEmptyState
        action={
          onRetry ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void onRetry()}
            >
              Try again
            </Button>
          ) : null
        }
        description="Something went wrong while loading your lessons. Try again in a moment."
        title="Could not load lessons"
      />
    );
  }

  if (!summary.hasLessons) {
    return GLOBAL_EMPTY_STATE;
  }

  const mode: LessonHeroMode = visibleSummary.allLessonsCompleted
    ? K_LESSON_HERO_MODE.REVIEW_FIRST
    : K_LESSON_HERO_MODE.NEXT;

  function handleSelectLevel(level: string) {
    setPreferredLevel(level);
    writeLessonLevelPreference(level);
  }

  return (
    <div
      className="container-max mx-auto flex w-full flex-col pb-4 lg:pb-6"
      data-testid="lesson-page"
    >
      <h1 className="sr-only">Lessons</h1>
      {source && (
        <LessonHero
          completedCount={heroCompletedCount}
          mode={mode}
          target={{
            lessonId: source.id,
            lessonTitle: source.title,
            goal: source.goal,
            familyId: source.family_id,
            cefrLevel: source.cefr_level,
            inProgress: source.state === K_LESSON_STATE.IN_PROGRESS,
            estimatedMinutes: source.estimated_minutes,
          }}
          totalCount={visibleLessons.length}
        />
      )}

      <div
        data-testid="lesson-browse-content"
        className="mt-4 w-full space-y-4 sm:mt-5"
      >
        {selectedLevel && levelOptions.length > 0 ? (
          <LessonLevelSelector
            options={levelOptions}
            selectedLevel={selectedLevel}
            onSelect={handleSelectLevel}
          />
        ) : null}

        <div className="space-y-5">
          <LessonGroupSection
            lessons={visibleGroups.incomplete}
            title="Lessons"
          />
          <CompletedLessonGroup lessons={visibleGroups.completed} />
        </div>
      </div>
    </div>
  );
}
