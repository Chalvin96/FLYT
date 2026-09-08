import { ChevronDown } from 'lucide-react';

import { AppCard } from '@/components/common/AppCard/AppCard';
import type { LessonSummaryRead } from '@/types/api';

import { K_LESSON_HERO_MODE, K_LESSON_STATE } from './constants';
import { LessonEmptyState } from './LessonEmptyState';
import { groupLessons } from './lessonGroups';
import { LessonHero, type LessonHeroMode } from './LessonHero';
import type { LessonLevelOption } from './lessonLevel';
import { LessonLevelSelector } from './LessonLevelSelector';
import { LessonListItem } from './LessonListItem';
import { LessonErrorState, LessonLoadingState } from './LessonPageStates';
import { summarize, useLessonLevelSelection } from './useLessonLevelSelection';

type LessonPageProps = {
  lessons?: LessonSummaryRead[];
  isError?: boolean;
  isLoading?: boolean;
  onRetry?: () => void | Promise<unknown>;
};

const GLOBAL_EMPTY_STATE = (
  <LessonEmptyState
    description="New lessons will appear here as soon as they are available."
    title="No lessons yet"
  />
);
const EMPTY_LESSONS: LessonSummaryRead[] = [];

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
          className="type-section font-semibold text-foreground"
          id={headingId}
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
      className="group overflow-hidden radius-section border border-border bg-card shadow-raised"
      data-testid="completed-lessons"
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
  const { levelOptions, selectLevel, selectedLevel, visibleLessons } =
    useLessonLevelSelection(lessons);

  if (isLoading) {
    return <LessonLoadingState />;
  }

  if (isError) {
    return <LessonErrorState onRetry={onRetry} />;
  }

  if (!summary.hasLessons) {
    return GLOBAL_EMPTY_STATE;
  }

  return (
    <LessonBrowseContent
      hero={buildHeroProps(visibleLessons)}
      levelOptions={levelOptions}
      lessons={visibleLessons}
      selectedLevel={selectedLevel}
      onSelectLevel={selectLevel}
    />
  );
}

interface HeroProps {
  completedCount: number;
  mode: LessonHeroMode;
  source: ReturnType<typeof summarize>['resume'];
  totalCount: number;
}

function buildHeroProps(visibleLessons: LessonSummaryRead[]): HeroProps {
  const visibleSummary = summarize(visibleLessons);
  const source = visibleSummary.allLessonsCompleted
    ? visibleSummary.first
    : visibleSummary.resume;

  return {
    source,
    mode: visibleSummary.allLessonsCompleted
      ? K_LESSON_HERO_MODE.REVIEW_FIRST
      : K_LESSON_HERO_MODE.NEXT,
    completedCount: visibleLessons.filter(
      (lesson) => lesson.state === K_LESSON_STATE.COMPLETED,
    ).length,
    totalCount: visibleLessons.length,
  };
}

function LessonBrowseContent({
  hero,
  levelOptions,
  lessons,
  selectedLevel,
  onSelectLevel,
}: {
  hero: HeroProps;
  levelOptions: LessonLevelOption[];
  lessons: LessonSummaryRead[];
  selectedLevel: string | null;
  onSelectLevel: (level: string) => void;
}) {
  const visibleGroups = groupLessons(lessons);
  const { source } = hero;

  return (
    <div
      className="container-max mx-auto flex w-full flex-col pb-4 lg:pb-6"
      data-testid="lesson-page"
    >
      <h1 className="sr-only">Lessons</h1>
      {source && (
        <LessonHero
          completedCount={hero.completedCount}
          mode={hero.mode}
          target={{
            lessonId: source.id,
            lessonTitle: source.title,
            goal: source.goal,
            familyId: source.family_id,
            cefrLevel: source.cefr_level,
            inProgress: source.state === K_LESSON_STATE.IN_PROGRESS,
            estimatedMinutes: source.estimated_minutes,
          }}
          totalCount={hero.totalCount}
        />
      )}

      <div
        className="mt-4 w-full space-y-4 sm:mt-5"
        data-testid="lesson-browse-content"
      >
        {selectedLevel && levelOptions.length > 0 ? (
          <LessonLevelSelector
            onSelect={onSelectLevel}
            options={levelOptions}
            selectedLevel={selectedLevel}
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
