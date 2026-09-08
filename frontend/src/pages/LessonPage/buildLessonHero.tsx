import { Clock } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';

import {
  DecoDone,
  DecoLessons,
  DecoReview,
} from '@/components/common/BaseHeroCard/decorations';
import type { BaseHeroCardProps } from '@/components/common/BaseHeroCard/types';
import { Button } from '@/components/common/Button/Button';

import { K_LESSON_HERO_MODE, type LessonHeroMode } from './constants';

export interface LessonHeroTarget {
  lessonId: number;
  lessonTitle: string;
  goal?: string | null;
  familyId: string | null;
  cefrLevel: string | null;
  inProgress: boolean;
  estimatedMinutes?: number | null;
}

export interface LessonHeroProps {
  mode: LessonHeroMode;
  target: LessonHeroTarget;
  completedCount: number;
  totalCount: number;
}

type HeroConfig = {
  className: string;
  badge: string;
  decoration: ReactNode;
  buttonText: string;
  buttonClassName: string;
  getLabel: (target: LessonHeroTarget) => string;
  getTitle: (target: LessonHeroTarget) => string;
  getSubtitle: (target: LessonHeroTarget) => string;
  subtitleClass?: string;
};

type HeroConfigKey = 'REVIEW_FIRST' | 'IN_PROGRESS' | 'UP_NEXT';

const HERO_CONFIGS: Record<HeroConfigKey, HeroConfig> = {
  REVIEW_FIRST: {
    className: 'bg-secondary-50 text-white-100',
    badge: 'Complete',
    decoration: <DecoDone />,
    buttonText: 'Review first lesson',
    buttonClassName: 'bg-white-100 text-secondary-90 hover:bg-white-90',
    getLabel: () => 'All done',
    getTitle: () => 'All lessons completed!',
    getSubtitle: () =>
      'Review from the beginning any time you want another pass through the path',
    subtitleClass: 'text-white-70 type-body',
  },
  IN_PROGRESS: {
    className: 'bg-primary-70 text-white-100',
    badge: 'In progress',
    decoration: <DecoReview />,
    buttonText: 'Continue lesson',
    buttonClassName: 'bg-white-100 text-primary-90 hover:bg-white-90',
    getLabel: (t) => buildHeroLabel(t.familyId, t.cefrLevel),
    getTitle: (t) => t.lessonTitle,
    getSubtitle: (t) => t.goal ?? '',
  },
  UP_NEXT: {
    className: 'bg-secondary-70 text-white-100',
    badge: 'Up next',
    decoration: <DecoLessons />,
    buttonText: 'Start this lesson',
    buttonClassName: 'bg-white-100 text-secondary-90 hover:bg-white-90',
    getLabel: (t) => buildHeroLabel(t.familyId, t.cefrLevel),
    getTitle: (t) => t.lessonTitle,
    getSubtitle: (t) => t.goal ?? '',
  },
};

function buildHeroLabel(familyId: string | null, cefrLevel: string | null) {
  const family = familyId ? familyId.replace(/_/g, ' ') : 'Lessons';
  return cefrLevel ? `${family} · ${cefrLevel}` : family;
}

function getHeroConfigKey(
  mode: LessonHeroMode,
  inProgress: boolean,
): HeroConfigKey {
  if (mode === K_LESSON_HERO_MODE.REVIEW_FIRST) return 'REVIEW_FIRST';
  if (inProgress) return 'IN_PROGRESS';
  return 'UP_NEXT';
}

export function buildLessonHero({
  mode,
  target,
  completedCount,
  totalCount,
}: LessonHeroProps): BaseHeroCardProps {
  const configKey = getHeroConfigKey(mode, target.inProgress);
  const config = HERO_CONFIGS[configKey];
  const hasEstimate =
    target.estimatedMinutes != null && target.estimatedMinutes > 0;

  return {
    className: config.className,
    label: config.getLabel(target),
    labelClass: 'text-white-60',
    badge: config.badge,
    badgeClass: 'bg-white-20 text-white-100',
    title: config.getTitle(target),
    subtitle: config.getSubtitle(target),
    subtitleClass: config.subtitleClass ?? 'text-white-70',
    decoration: config.decoration,
    ...(hasEstimate
      ? {
          chip: {
            label: `~${target.estimatedMinutes} min`,
            className: 'bg-black-10 text-white-70',
            icon: <Clock aria-hidden className="icon-sm" />,
          },
        }
      : {}),
    progress: {
      current: completedCount,
      total: totalCount,
      showBar: true,
      showPercentage: true,
    },
    primaryAction: (
      <Button
        asChild
        className={`w-full ${config.buttonClassName} sm:w-auto`}
        size="sm"
      >
        <Link
          params={{ lessonId: String(target.lessonId) }}
          to="/lesson/$lessonId"
        >
          {config.buttonText}
        </Link>
      </Button>
    ),
  };
}
