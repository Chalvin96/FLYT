import { Button, Text } from '@flyt/ui';
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
      tone: 'brand',
      label: 'Ready now',
      badge: 'Focus mode',
      title: 'Your review queue',
      subtitle: `${pluralize(dueCount, 'card')} · ~${estMinutes} min session`,
      decoration: <DecoReview />,
      primaryAction: (
        <Button asChild size="sm" variant="primary" width="full-on-mobile">
          <Link to={reviewHref as never}>Start review</Link>
        </Button>
      ),
      secondaryAction: (
        <Link
          className="text-center text-[var(--hero-copy)] underline-offset-2 hover:text-[var(--hero-text)] hover:underline sm:text-left"
          search={{ mode: 'quick' } as never}
          to={reviewHref as never}
        >
          <Text as="span" size="medium">
            Quick session -&gt;
          </Text>
        </Link>
      ),
    };
  }

  if (state === K_HERO_STATE_RISK) {
    return {
      tone: 'calm',
      label: 'Keep your rhythm',
      badge: 'Streak',
      title: 'A few cards keeps it going',
      subtitle: "You haven't practiced today yet",
      decoration: <DecoRisk />,
      chip:
        streak > 0
          ? {
              label: `${streak}-day streak`,
              icon: <Flame className="icon-sm" strokeWidth={2} />,
            }
          : undefined,
      primaryAction: (
        <Button asChild size="sm" width="full-on-mobile">
          <Link search={{ mode: 'quick' } as never} to={reviewHref as never}>
            Quick session
          </Link>
        </Button>
      ),
      secondaryAction: (
        <Link
          className="text-center text-[var(--hero-copy)] underline-offset-2 hover:text-[var(--hero-text)] hover:underline sm:text-left"
          to={reviewHref as never}
        >
          <Text as="span" size="medium">
            Full review -&gt;
          </Text>
        </Link>
      ),
    };
  }

  if (state === K_HERO_STATE_LESSONS) {
    return {
      tone: 'calm',
      label: 'Keep going',
      badge: 'Path mode',
      title: 'New lesson in your path',
      subtitle: 'Pick up where you left off',
      decoration: <DecoLessons />,
      primaryAction: (
        <Button asChild size="sm" variant="primary" width="full-on-mobile">
          <Link to={lessonsHref as never}>Open lessons</Link>
        </Button>
      ),
    };
  }

  if (state === K_HERO_STATE_EMPTY) {
    return {
      tone: 'quiet',
      label: 'Getting started',
      badge: 'Welcome',
      title: 'Welcome to Flyt!',
      subtitle: 'Start a lesson to begin building your review queue',
      decoration: <DecoEmpty />,
      primaryAction: (
        <Button asChild size="sm" width="full-on-mobile">
          <Link to={lessonsHref as never}>Start first lesson</Link>
        </Button>
      ),
    };
  }

  return {
    tone: 'quiet',
    label: 'All done',
    badge: 'Rest mode',
    title: "You're all caught up",
    subtitle: 'Nothing due right now - come back tomorrow',
    decoration: <DecoDone />,
    chip:
      streak > 0
        ? {
            label: `${streak}-day streak`,
            icon: <Flame className="icon-sm" strokeWidth={2} />,
          }
        : undefined,
    primaryAction: (
      <Button asChild size="sm" width="full-on-mobile">
        <Link to={'/reading'}>Go reading</Link>
      </Button>
    ),
    secondaryAction: (
      <Link
        className="text-center text-subtle underline-offset-2 hover:underline sm:text-left"
        search={{ mode: 'quick' } as never}
        to={reviewHref as never}
      >
        <Text as="span" size="medium">
          Quick session -&gt;
        </Text>
      </Link>
    ),
  };
}
