import { Button } from '@flyt/ui';
import { Clock } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';

import {
  DecoDone,
  DecoLessons,
  DecoReview,
} from '@/components/common/BaseHeroCard/decorations';
import type { BaseHeroCardProps } from '@/components/common/BaseHeroCard/types';
import { sentenceCaseLabel } from '@/lib/utils';

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
  tone: 'brand' | 'calm' | 'deep';
  badge: string;
  decoration: ReactNode;
  buttonText: string;
  getLabel: (target: LessonHeroTarget) => string;
  getTitle: (target: LessonHeroTarget) => string;
  getSubtitle: (target: LessonHeroTarget) => string;
};

type HeroConfigKey = 'REVIEW_FIRST' | 'IN_PROGRESS' | 'UP_NEXT';

const HERO_CONFIGS: Record<HeroConfigKey, HeroConfig> = {
  REVIEW_FIRST: {
    tone: 'calm' as const,
    badge: 'Complete',
    decoration: <DecoDone />,
    buttonText: 'Review first lesson',
    getLabel: () => 'All done',
    getTitle: () => 'All lessons completed!',
    getSubtitle: () =>
      'Review from the beginning any time you want another pass through the path',
  },
  IN_PROGRESS: {
    tone: 'brand' as const,
    badge: 'In progress',
    decoration: <DecoReview />,
    buttonText: 'Continue lesson',
    getLabel: (t) => buildHeroLabel(t.familyId, t.cefrLevel),
    getTitle: (t) => t.lessonTitle,
    getSubtitle: (t) => t.goal ?? '',
  },
  UP_NEXT: {
    tone: 'deep' as const,
    badge: 'Up next',
    decoration: <DecoLessons />,
    buttonText: 'Start this lesson',
    getLabel: (t) => buildHeroLabel(t.familyId, t.cefrLevel),
    getTitle: (t) => t.lessonTitle,
    getSubtitle: (t) => t.goal ?? '',
  },
};

function buildHeroLabel(familyId: string | null, cefrLevel: string | null) {
  const family = familyId ? sentenceCaseLabel(familyId, 'slug') : 'Lessons';
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
    tone: config.tone,
    label: config.getLabel(target),
    badge: config.badge,
    title: config.getTitle(target),
    subtitle: config.getSubtitle(target),
    decoration: config.decoration,
    ...(hasEstimate
      ? {
          chip: {
            label: `~${target.estimatedMinutes} min`,
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
      <Button asChild size="sm" variant="primary" width="full-on-mobile">
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
