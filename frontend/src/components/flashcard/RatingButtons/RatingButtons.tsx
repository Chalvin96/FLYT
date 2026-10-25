import { Button, Text } from '@flyt/ui';
import { useEffect, useEffectEvent, useId, useRef } from 'react';

import type { RatingPreviews } from '@/types/api';

export interface RatingButtonsProps {
  onRate: (rating: 1 | 2 | 3 | 4) => void;
  /** Per-rating interval labels (e.g. "1m") shown under each button. */
  previews?: RatingPreviews;
  disabled?: boolean;
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
    // An effect event is only callable from inside an effect, so the DOM gets a
    // plain listener rather than its reference.
    const handleKeyDown = (event: KeyboardEvent) => handleRatingKey(event);
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      className="mx-auto w-full max-w-[30rem] space-y-2"
      ref={scopeRef}
      role="group"
      aria-label="Rate this card"
    >
      <p className="sr-only" id={descriptionId}>
        Rate this card from 1 for Again to 4 for Easy.
      </p>
      <div className="flex w-full gap-2">
        {RATINGS.map(({ rating, label, key }) => (
          <div
            className={key === 'again' ? 'mr-1 flex-1 sm:mr-2' : 'flex-1'}
            key={rating}
          >
            <Button
              aria-describedby={descriptionId}
              aria-label={
                previews ? `${label}, next in ${previews[key]}` : label
              }
              disabled={disabled}
              onClick={() => onRate(rating)}
              size="lg"
              variant="outline"
              width="full"
            >
              <span className="flex flex-col items-center gap-0.5">
                <span>{label}</span>
                {previews ? (
                  <Text as="span" size="medium" tone="subtle">
                    {previews[key]}
                  </Text>
                ) : null}
              </span>
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
