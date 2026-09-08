import { BaseHeroCard } from '@/components/common/BaseHeroCard/BaseHeroCard';

import {
  buildDashboardHero,
  type DashboardHeroProps,
} from './buildDashboardHero';

export type { DashboardHeroProps };

export function DashboardHero(props: DashboardHeroProps) {
  return <BaseHeroCard {...buildDashboardHero(props)} />;
}
