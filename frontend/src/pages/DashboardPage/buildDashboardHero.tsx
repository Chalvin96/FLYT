import { Flame } from 'lucide-react';
import { Link } from '@tanstack/react-router';

import {
  DecoDone,
  DecoEmpty,
  DecoLessons,
  DecoReview,
  DecoRisk,
} from '@/components/common/BaseHeroCard/decorations';
import type { BaseHeroCardProps } from '@/components/common/BaseHeroCard/types';
import { Button } from '@/components/common/Button/Button';
import { pluralize } from '@/lib/utils';

import {
  K_HERO_STATE_DONE,
  K_HERO_STATE_EMPTY,
  K_HERO_STATE_LESSONS,
  K_HERO_STATE_REVIEW,
  K_HERO_STATE_RISK,
} from './constants';

export interface DashboardHeroProps {
  state:
    | typeof K_HERO_STATE_REVIEW
    | typeof K_HERO_STATE_RISK
    | typeof K_HERO_STATE_LESSONS
    | typeof K_HERO_STATE_DONE
    | typeof K_HERO_STATE_EMPTY;
  dueCount: number;
  streak: number;
  lessonsHref: string;
  reviewHref: string;
}

export function buildDashboardHero({
  state,
  dueCount,
  streak,
  lessonsHref,
  reviewHref,
}: DashboardHeroProps): BaseHeroCardProps {
  const estMinutes = Math.max(1, Math.round(dueCount * 0.25));

  if (state === K_HERO_STATE_REVIEW) {
    return {
      className: 'bg-primary-70 text-white-100',
      label: 'Ready now',
      labelClass: 'text-white-60',
      badge: 'Focus mode',
      badgeClass: 'bg-white-20 text-white-100',
      title: 'Your review queue',
      subtitle: `${pluralize(dueCount, 'card')} · ~${estMinutes} min session`,
      subtitleClass: 'text-white-70',
      decoration: <DecoReview />,
      primaryAction: (
        <Button
          asChild
          className="w-full bg-white-100 text-primary-90 hover:bg-white-90 sm:w-auto"
          size="sm"
        >
          <Link to={reviewHref as never}>Start review</Link>
        </Button>
      ),
      secondaryAction: (
        <Link
          className="type-caption text-center text-white-60 underline-offset-2 hover:text-white-90 hover:underline sm:text-left"
          search={{ mode: 'quick' } as never}
          to={reviewHref as never}
        >
          Quick session -&gt;
        </Link>
      ),
    };
  }

  if (state === K_HERO_STATE_RISK) {
    return {
      className: 'bg-warning-10 text-foreground',
      label: "Don't break it",
      labelClass: 'text-warning-70',
      badge: 'Streak mode',
      badgeClass: 'bg-black-10 text-warning-70',
      title: 'Review before midnight',
      subtitle: "You haven't practiced today yet",
      subtitleClass: 'text-foreground/60',
      decoration: <DecoRisk />,
      chip:
        streak > 0
          ? {
              label: `${streak}-day streak`,
              icon: <Flame className="icon-sm" strokeWidth={2} />,
              className: 'bg-black-10 text-warning-70',
            }
          : undefined,
      primaryAction: (
        <Button
          asChild
          className="w-full bg-warning-40 text-secondary-100 hover:bg-warning-30 sm:w-auto"
          size="sm"
        >
          <Link to={reviewHref as never}>Start review</Link>
        </Button>
      ),
      secondaryAction: (
        <Link
          className="type-caption text-center text-warning-70/70 underline-offset-2 hover:text-warning-70 hover:underline sm:text-left"
          search={{ mode: 'quick' } as never}
          to={reviewHref as never}
        >
          Quick session -&gt;
        </Link>
      ),
    };
  }

  if (state === K_HERO_STATE_LESSONS) {
    return {
      className: 'bg-secondary-50 text-white-100',
      label: 'Keep going',
      labelClass: 'text-white-60',
      badge: 'Path mode',
      badgeClass: 'bg-white-20 text-white-100',
      title: 'New lesson in your path',
      subtitle: 'Pick up where you left off',
      subtitleClass: 'text-white-70',
      decoration: <DecoLessons />,
      primaryAction: (
        <Button
          asChild
          className="w-full bg-white-100 text-secondary-90 hover:bg-white-90 sm:w-auto"
          size="sm"
        >
          <Link to={lessonsHref as never}>Open lessons</Link>
        </Button>
      ),
    };
  }

  if (state === K_HERO_STATE_EMPTY) {
    return {
      className:
        'bg-secondary-10 text-foreground border border-dashed border-secondary-30',
      label: 'Getting started',
      labelClass: 'text-secondary-60',
      badge: 'Welcome',
      badgeClass: 'bg-black-10 text-secondary-70',
      title: 'Welcome to Flyt!',
      subtitle: 'Start a lesson to begin building your review queue',
      subtitleClass: 'text-muted-foreground',
      decoration: <DecoEmpty />,
      primaryAction: (
        <Button
          asChild
          className="w-full bg-primary-70 text-white-100 hover:bg-primary-60 sm:w-auto"
          size="sm"
        >
          <Link to={lessonsHref as never}>Start first lesson</Link>
        </Button>
      ),
    };
  }

  return {
    className: 'bg-secondary-20 text-foreground',
    label: 'All done',
    labelClass: 'text-secondary-60',
    badge: 'Rest mode',
    badgeClass: 'bg-black-10 text-secondary-70',
    title: "You're all caught up",
    subtitle: 'Nothing due right now - come back tomorrow',
    subtitleClass: 'text-muted-foreground',
    decoration: <DecoDone />,
    chip:
      streak > 0
        ? {
            label: `${streak}-day streak`,
            icon: <Flame className="icon-sm" strokeWidth={2} />,
            className: 'bg-black-10 text-secondary-70',
          }
        : undefined,
    primaryAction: (
      <Button
        asChild
        className="w-full bg-secondary-60 text-white-100 hover:bg-secondary-50 sm:w-auto"
        size="sm"
      >
        <Link to={'/reading'}>Go reading</Link>
      </Button>
    ),
    secondaryAction: (
      <Link
        className="type-caption text-center text-secondary-70 underline-offset-2 hover:underline sm:text-left"
        search={{ mode: 'quick' } as never}
        to={reviewHref as never}
      >
        Quick session -&gt;
      </Link>
    ),
  };
}
