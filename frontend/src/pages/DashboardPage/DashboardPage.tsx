import { m } from 'motion/react';

import { AppCard } from '@/components/common/AppCard/AppCard';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardStatsRead } from '@/types/api';

import {
  emptySnapshot,
  K_HERO_STATE_DONE,
  K_HERO_STATE_EMPTY,
  K_HERO_STATE_LESSONS,
  K_HERO_STATE_REVIEW,
  K_HERO_STATE_RISK,
  stagger,
} from './constants';
import { DashboardHero } from './DashboardHero';
import { DashboardPracticeCards } from './DashboardPracticeCards';
import { DashboardSnapshot } from './DashboardSnapshot';
import { DashboardStats } from './DashboardStats';

export interface DashboardPageProps {
  stats: DashboardStatsRead | null;
  isError?: boolean;
  isLoading?: boolean;
}

function buildDashboardModel(stats: DashboardStatsRead | null) {
  const dueCount = stats?.dueCount ?? 0;
  const lessonCount = stats?.lessonCount ?? 0;
  const snapshot = stats?.snapshot ?? emptySnapshot;
  const streak = stats?.streak ?? 0;
  const reviewedToday =
    (snapshot.this_week[(new Date().getUTCDay() + 6) % 7] ?? 0) > 0;
  const isNewUser =
    (stats?.wordsPracticed ?? 0) === 0 && dueCount === 0 && lessonCount === 0;
  const streakAtRisk =
    streak > 0 &&
    !reviewedToday &&
    dueCount > 0 &&
    new Date().getUTCHours() >= 18;
  let state:
    | typeof K_HERO_STATE_DONE
    | typeof K_HERO_STATE_EMPTY
    | typeof K_HERO_STATE_RISK
    | typeof K_HERO_STATE_REVIEW
    | typeof K_HERO_STATE_LESSONS = K_HERO_STATE_DONE;
  if (isNewUser) state = K_HERO_STATE_EMPTY;
  else if (streakAtRisk) state = K_HERO_STATE_RISK;
  else if (dueCount > 0) state = K_HERO_STATE_REVIEW;
  else if (lessonCount > 0) state = K_HERO_STATE_LESSONS;
  return {
    accuracy7d: stats?.accuracy7d ?? null,
    dueCount,
    dueNew: stats?.dueNew ?? 0,
    lessonCount,
    snapshot,
    state,
    streak,
    totalWordsPracticed: stats?.wordsPracticed ?? 0,
  };
}

function DashboardLoading() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <Skeleton className="radius-field h-16" />
      <Skeleton className="radius-section h-40" />
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((slot) => (
          <Skeleton key={slot} className="radius-field h-40" />
        ))}
      </div>
    </div>
  );
}

function DashboardError() {
  return (
    <AppCard className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Could not load dashboard</CardTitle>
        <p className="type-body text-muted-foreground">
          Try refreshing the page.
        </p>
      </CardHeader>
    </AppCard>
  );
}

export function DashboardPage({
  stats,
  isError,
  isLoading,
}: DashboardPageProps) {
  if (isLoading) {
    return <DashboardLoading />;
  }

  if (isError) {
    return <DashboardError />;
  }
  return <DashboardContent model={buildDashboardModel(stats)} />;
}

function DashboardContent({
  model,
}: {
  model: ReturnType<typeof buildDashboardModel>;
}) {
  const lessonsHref = '/lesson';
  const reviewHref = '/review';

  return (
    <m.div
      className="container-max mx-auto flex w-full flex-col gap-4 pb-4"
      initial="hidden"
      animate="visible"
      variants={stagger}
    >
      <DashboardHero
        dueCount={model.dueCount}
        lessonsHref={lessonsHref}
        reviewHref={reviewHref}
        state={model.state}
        streak={model.streak}
      />

      {/* Mobile/tablet: Stats → Practice cards → Snapshot (stacked)
          Desktop: left col = Stats + Snapshot, right col = Practice cards spanning both rows */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-dashboard lg:items-start lg:gap-6">
        {/* Stats: mobile row 1, desktop left col row 1 */}
        <div className="lg:col-start-1 lg:row-start-1">
          <DashboardStats
            accuracy7d={model.accuracy7d}
            cardsThisWeek={model.snapshot.this_week.reduce((a, b) => a + b, 0)}
            dueCount={model.dueCount}
            dueNew={model.dueNew}
            totalWordsPracticed={model.totalWordsPracticed}
          />
        </div>

        {/* Practice cards: mobile row 2, desktop right col spanning both rows */}
        <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <DashboardPracticeCards
            dueCount={model.dueCount}
            lessonCount={model.lessonCount}
            lessonsHref={lessonsHref}
            lessonsRemaining={model.lessonCount > 0}
            reviewHref={reviewHref}
            reviewRemaining={model.dueCount > 0}
          />
        </div>

        {/* Snapshot: mobile row 3, desktop left col row 2 */}
        <div className="lg:col-start-1 lg:row-start-2">
          <DashboardSnapshot
            practiceSnapshot={model.snapshot}
            streak={model.streak}
          />
        </div>
      </div>
    </m.div>
  );
}
