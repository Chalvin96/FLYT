import { BaseHeroCard } from '@/components/common/BaseHeroCard/BaseHeroCard';

import { buildLessonHero, type LessonHeroProps } from './buildLessonHero';
import { type LessonHeroMode } from './constants';

export type { LessonHeroProps, LessonHeroTarget } from './buildLessonHero';
export type { LessonHeroMode };

export function LessonHero(props: LessonHeroProps) {
  return <BaseHeroCard {...buildLessonHero(props)} />;
}
