import { m } from 'motion/react';

import { Badge } from '@/components/ui/badge';
import { formatNumber } from '@/lib/utils';

import { fadeUp } from './constants';
import { StatCard } from './StatCard';

type Props = {
  accuracy7d: number | null;
  cardsThisWeek: number;
  dueCount: number;
  dueNew: number;
  totalWordsPracticed: number;
};

function AccuracyBadge({ accuracy }: { accuracy: number }) {
  if (accuracy >= 0.85) {
    return (
      <Badge className="border-secondary-30 bg-secondary-10 px-2 py-0.5 type-caption-sm text-secondary-70 hover:bg-secondary-10">
        Strong
      </Badge>
    );
  }
  if (accuracy >= 0.75) {
    return (
      <Badge className="border-secondary-30 bg-secondary-10 px-2 py-0.5 type-caption-sm text-secondary-70 hover:bg-secondary-10">
        Steady
      </Badge>
    );
  }
  return null;
}

export function DashboardStats({
  accuracy7d,
  cardsThisWeek,
  dueCount,
  dueNew,
  totalWordsPracticed,
}: Props) {
  const dueReview = Math.max(0, dueCount - dueNew);

  return (
    <m.section
      className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-2"
      variants={fadeUp}
    >
      <StatCard
        borderClass="border-secondary-50"
        label="New · Review due"
        value={`${formatNumber(dueNew)} / ${formatNumber(dueReview)}`}
      />

      <StatCard
        borderClass="border-accent-40"
        label="Accuracy this week"
        value={
          accuracy7d === null ? (
            <span aria-label="no data">—</span>
          ) : (
            `${Math.round(accuracy7d * 100)}%`
          )
        }
        badge={
          accuracy7d !== null ? (
            <AccuracyBadge accuracy={accuracy7d} />
          ) : undefined
        }
      />

      <StatCard
        borderClass="border-warning-40"
        label="Cards this week"
        value={formatNumber(cardsThisWeek)}
        badge={
          cardsThisWeek >= 50 ? (
            <Badge className="border-accent-20 bg-accent-10 px-2 py-0.5 type-caption-sm text-accent-70 hover:bg-accent-10">
              50+ this week
            </Badge>
          ) : undefined
        }
      />

      <StatCard
        borderClass="border-primary-70"
        label="Words practiced"
        value={formatNumber(totalWordsPracticed)}
      />
    </m.section>
  );
}
