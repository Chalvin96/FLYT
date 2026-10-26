import { K_RATING_AGAIN, K_RATING_EASY } from './fsrsRatings';

export type Rating = 1 | 2 | 3 | 4;

export type OperationResult = {
  correct: boolean;
  rating?: number;
};

function isRating(value: number): value is Rating {
  return (
    Number.isInteger(value) && value >= K_RATING_AGAIN && value <= K_RATING_EASY
  );
}

export type GradedOutcome = {
  kind: 'graded';
  correct: boolean;
  rating: Rating;
};

/** Use when an exercise advances without creating scheduling evidence. */
export type UngradedOutcome = {
  kind: 'ungraded';
  outcome: 'skipped' | 'service_unavailable' | 'unsupported';
};

export type ExerciseOutcome = GradedOutcome | UngradedOutcome;

export function ratingFromResult(result: OperationResult): Rating {
  if (typeof result.rating === 'number') {
    if (!isRating(result.rating)) {
      throw new Error(`Invalid rating: ${result.rating}`);
    }
    return result.rating;
  }
  return result.correct ? K_RATING_EASY : K_RATING_AGAIN;
}

export function gradedOutcome(result: OperationResult): GradedOutcome {
  return {
    kind: 'graded',
    correct: result.correct,
    rating: ratingFromResult(result),
  };
}
