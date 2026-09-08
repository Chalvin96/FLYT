import { motion } from 'motion/react';

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

export function DashboardPage({
  stats,
  isError = false,
  isLoading = false,
}: DashboardPageProps) {
  const dueCount = stats?.dueCount ?? 0;
  const dueNew = stats?.dueNew ?? 0;
  const lessonCount = stats?.lessonCount ?? 0;
  const accuracy7d = stats?.accuracy7d ?? null;
  const practiceSnapshot = stats?.snapshot ?? emptySnapshot;
  const streak = stats?.streak ?? 0;
  const totalWordsPracticed = stats?.wordsPracticed ?? 0;
  const lessonsHref = '/lesson';
  const reviewHref = '/review';

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <Skeleton className="radius-field h-16" />
        <Skeleton className="radius-section h-40" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="radius-field h-40" />
          <Skeleton className="radius-field h-40" />
          <Skeleton className="radius-field h-40" />
          <Skeleton className="radius-field h-40" />
        </div>
      </div>
    );
  }

  if (isError) {
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

  const lessonsRemaining = lessonCount > 0;
  const reviewRemaining = dueCount > 0;
  const isNewUser =
    totalWordsPracticed === 0 && dueCount === 0 && lessonCount === 0;
  const reviewedToday =
    (practiceSnapshot.this_week[(new Date().getUTCDay() + 6) % 7] ?? 0) > 0;
  const streakAtRisk =
    streak > 0 &&
    !reviewedToday &&
    dueCount > 0 &&
    new Date().getUTCHours() >= 18;

  function resolveState() {
    if (isNewUser) return K_HERO_STATE_EMPTY;
    if (streakAtRisk) return K_HERO_STATE_RISK;
    if (dueCount > 0) return K_HERO_STATE_REVIEW;
    if (lessonsRemaining) return K_HERO_STATE_LESSONS;
    return K_HERO_STATE_DONE;
  }
  const state = resolveState();

  return (
    <motion.div
      className="container-max mx-auto flex w-full flex-col gap-4 pb-4"
      initial="hidden"
      animate="visible"
      variants={stagger}
    >
      <DashboardHero
        dueCount={dueCount}
        lessonsHref={lessonsHref}
        reviewHref={reviewHref}
        state={state}
        streak={streak}
      />

      {/* Mobile/tablet: Stats → Practice cards → Snapshot (stacked)
          Desktop: left col = Stats + Snapshot, right col = Practice cards spanning both rows */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-dashboard lg:items-start lg:gap-6">
        {/* Stats: mobile row 1, desktop left col row 1 */}
        <div className="lg:col-start-1 lg:row-start-1">
          <DashboardStats
            accuracy7d={accuracy7d}
            cardsThisWeek={practiceSnapshot.this_week.reduce(
              (a, b) => a + b,
              0,
            )}
            dueCount={dueCount}
            dueNew={dueNew}
            totalWordsPracticed={totalWordsPracticed}
          />
        </div>

        {/* Practice cards: mobile row 2, desktop right col spanning both rows */}
        <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <DashboardPracticeCards
            dueCount={dueCount}
            lessonCount={lessonCount}
            lessonsHref={lessonsHref}
            lessonsRemaining={lessonsRemaining}
            reviewHref={reviewHref}
            reviewRemaining={reviewRemaining}
          />
        </div>

        {/* Snapshot: mobile row 3, desktop left col row 2 */}
        <div className="lg:col-start-1 lg:row-start-2">
          <DashboardSnapshot
            practiceSnapshot={practiceSnapshot}
            streak={streak}
          />
        </div>
      </div>
    </motion.div>
  );
}
