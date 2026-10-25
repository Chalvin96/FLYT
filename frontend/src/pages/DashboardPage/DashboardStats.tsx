import { Badge } from '@flyt/ui';
import { m } from 'motion/react';

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
    return <Badge>Strong</Badge>;
  }
  if (accuracy >= 0.75) {
    return <Badge>Steady</Badge>;
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
        borderClass="border-hovered"
        label="New · review due"
        value={`${formatNumber(dueNew)} / ${formatNumber(dueReview)}`}
      />

      <StatCard
        borderClass="border-success-subtle"
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
        borderClass="border-strong"
        label="Cards this week"
        value={formatNumber(cardsThisWeek)}
        badge={
          cardsThisWeek >= 50 ? (
            <Badge tone="success">50+ this week</Badge>
          ) : undefined
        }
      />

      <StatCard
        borderClass="border-selected"
        label="Words practiced"
        value={formatNumber(totalWordsPracticed)}
      />
    </m.section>
  );
}
