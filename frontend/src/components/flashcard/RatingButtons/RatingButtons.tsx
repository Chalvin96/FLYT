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
    <div
      className={cn('mx-auto w-full max-w-[30rem] space-y-2', className)}
      ref={scopeRef}
      role="group"
      aria-label="Rate this card"
    >
      <p className="sr-only" id={descriptionId}>
        Rate this card from 1 for Again to 4 for Easy.
      </p>
      <div className="flex w-full gap-2">
        {RATINGS.map(({ rating, label, key }) => (
          <Button
            key={rating}
            type="button"
            variant="outline"
            aria-describedby={descriptionId}
            aria-label={previews ? `${label}, next in ${previews[key]}` : label}
            className={cn(
              'flex h-12 min-w-0 flex-1 flex-col gap-0.5 px-1.5 py-1.5 type-caption shadow-none transition-colors hover:translate-y-0 active:translate-y-px focus-visible:z-10 max-[359px]:h-11',
              key === 'again' &&
                'mr-1 border-destructive-20 text-destructive-90 hover:border-destructive-30 hover:bg-destructive-0 hover:text-destructive-90 sm:mr-2',
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
