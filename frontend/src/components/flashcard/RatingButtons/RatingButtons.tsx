import { useEffect, useEffectEvent, useId, useRef } from 'react';

import { Button } from '@/components/common/Button/Button';
import { cn } from '@/lib/utils';
import type { RatingPreviews } from '@/types/api';

export interface RatingButtonsProps {
  onRate: (rating: 1 | 2 | 3 | 4) => void;
  /** Per-rating interval labels (e.g. "1m") shown under each button. */
  previews?: RatingPreviews;
  disabled?: boolean;
  className?: string;
}

const RATINGS = [
  { rating: 1 as const, label: 'Again', key: 'again' as const },
  { rating: 2 as const, label: 'Hard', key: 'hard' as const },
  { rating: 3 as const, label: 'Good', key: 'good' as const },
  { rating: 4 as const, label: 'Easy', key: 'easy' as const },
];

export const RatingButtons = ({
  onRate,
  previews,
  disabled = false,
  className = '',
}: RatingButtonsProps) => {
  const scopeRef = useRef<HTMLDivElement>(null);
  const descriptionId = useId();
  const handleRatingKey = useEffectEvent((event: KeyboardEvent) => {
    if (disabled) return;

    const activeElement = document.activeElement;
    if (!scopeRef.current?.contains(activeElement)) {
      return;
    }

    const key = event.key;
    if (key >= '1' && key <= '4') {
      event.preventDefault();
      onRate(parseInt(key, 10) as 1 | 2 | 3 | 4);
    }
  });

  useEffect(() => {
    // Call the effect event from a plain listener instead of handing its
    // reference to the DOM — effect events are only guaranteed callable from
    // inside effects.
    const handleKeyDown = (event: KeyboardEvent) => handleRatingKey(event);
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className={cn('space-y-2', className)} ref={scopeRef}>
      <p className="sr-only" id={descriptionId}>
        Rate this card from 1 for Again to 4 for Easy.
      </p>
      <div className="flex w-full flex-col gap-2 sm:flex-row">
        {RATINGS.map(({ rating, label, key }) => (
          <Button
            key={rating}
            type="button"
            variant="outline"
            aria-describedby={descriptionId}
            aria-label={previews ? `${label}, next in ${previews[key]}` : label}
            className={cn(
              'flex h-auto w-full flex-1 flex-col gap-0.5 px-0 py-2 type-caption shadow-none hover:translate-y-0',
              rating === 1 &&
                'hover:border-destructive-30 hover:bg-destructive-10 hover:text-destructive-90',
            )}
            onClick={() => onRate(rating)}
            disabled={disabled}
          >
            <span>{label}</span>
            {previews ? (
              <span className="type-caption font-normal text-muted-foreground">
                {previews[key]}
              </span>
            ) : null}
          </Button>
        ))}
      </div>
    </div>
  );
};
