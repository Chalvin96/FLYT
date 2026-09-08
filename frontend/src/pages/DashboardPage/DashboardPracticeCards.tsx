import { BookOpenText, BookText, Target, Zap } from 'lucide-react';
import { m } from 'motion/react';

import { fadeUp } from './constants';
import { PracticeCard, type PracticeCardProps } from './PracticeCard';

type Props = {
  dueCount: number;
  lessonCount: number;
  lessonsHref: string;
  lessonsRemaining: boolean;
  reviewHref: string;
  reviewRemaining: boolean;
};

const QUICK_CARD: PracticeCardProps = {
  to: '/review',
  search: { mode: 'quick' },
  icon: Zap,
  title: 'Quick session',
  subtitle: 'A short review session when you are low on time',
  iconTone: 'secondary',
};

const READING_CARD: PracticeCardProps = {
  to: '/reading',
  icon: BookText,
  title: 'Reading',
  subtitle: 'Read a short story to practise in context',
  iconTone: 'warning',
};

export function DashboardPracticeCards({
  dueCount,
  lessonCount,
  lessonsHref,
  lessonsRemaining,
  reviewHref,
  reviewRemaining,
}: Props) {
  const reviewCard: PracticeCardProps = {
    to: reviewHref,
    icon: Target,
    title: reviewRemaining ? 'Clear the queue' : 'Review your cards',
    subtitle: reviewRemaining
      ? `${dueCount} card${dueCount === 1 ? ' is' : 's are'} due right now`
      : 'Keep recall strong with a short review session',
    iconTone: 'primary',
  };
  const lessonsCard: PracticeCardProps = {
    to: lessonsHref,
    icon: BookOpenText,
    title: lessonsRemaining ? 'Continue your path' : 'Browse lessons',
    subtitle: lessonsRemaining
      ? `${lessonCount} lesson${lessonCount === 1 ? '' : 's'} available in your path`
      : 'Pick up a new lesson when you have time',
    iconTone: 'secondary',
  };
  // No cards due (e.g. a brand-new user): lead with learning, not an empty
  // review queue, and drop Quick session (it needs a populated queue).
  const cards: PracticeCardProps[] =
    dueCount > 0
      ? [reviewCard, QUICK_CARD, lessonsCard, READING_CARD]
      : [lessonsCard, READING_CARD, reviewCard];

  return (
    <m.section variants={fadeUp}>
      <div className="mb-3 px-1">
        <h2 className="type-title leading-none">Choose your next step</h2>
      </div>
      <div className="flex flex-col gap-3 md:grid md:grid-cols-2 lg:flex lg:flex-col">
        {cards.map((item) => (
          <PracticeCard key={item.title} {...item} />
        ))}
      </div>
    </m.section>
  );
}
