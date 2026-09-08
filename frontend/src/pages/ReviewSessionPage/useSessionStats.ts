import { useState } from 'react';

import type { SessionExerciseResult } from '@/components/flashcard/FlashcardSessionCard';
import { K_RATING_GOOD } from '@/lib/fsrsRatings';

/** Running totals for the completion screen, updated as reviews are accepted. */
export function useSessionStats() {
  const [reviewedCount, setReviewedCount] = useState(0);
  const [gradedCount, setGradedCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  const accuracy =
    gradedCount > 0 ? Math.round((correctCount / gradedCount) * 100) : null;

  const recordAcceptedResult = (result: SessionExerciseResult) => {
    setReviewedCount((c) => c + 1);
    if (result.kind === 'graded') {
      setGradedCount((c) => c + 1);
      if (result.rating >= K_RATING_GOOD) {
        setCorrectCount((c) => c + 1);
      }
    }
  };

  return { accuracy, recordAcceptedResult, reviewedCount };
}
