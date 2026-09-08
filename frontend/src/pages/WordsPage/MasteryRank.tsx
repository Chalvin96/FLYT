import { cn } from '@/lib/utils';
import type { MasteryBucket } from '@/types/api';

/**
 * Ordered mastery ladder: not_started < learning < familiar < known < mastered.
 * The rank cue is decorative; the text label remains the a11y source of truth.
 */
const BUCKET_ORDER: MasteryBucket[] = [
  'not_started',
  'learning',
  'familiar',
  'known',
  'mastered',
];

export interface MasteryRankProps {
  bucket: MasteryBucket;
  className?: string;
}

/**
 * Renders 5 filled/empty dots representing the bucket's position on the mastery
 * ladder. `aria-hidden` so screen readers rely on the adjacent text label.
 */
export function MasteryRank({ bucket, className }: MasteryRankProps) {
  const rank = BUCKET_ORDER.indexOf(bucket) + 1;

  return (
    <span
      aria-hidden="true"
      data-testid={`mastery-rank-${bucket}`}
      className={cn('inline-flex items-center gap-0.5', className)}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={cn(
            'size-1 rounded-full bg-current',
            i < rank ? 'opacity-100' : 'opacity-30',
          )}
        />
      ))}
    </span>
  );
}
