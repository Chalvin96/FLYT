import { createFileRoute } from '@tanstack/react-router';

import { ErrorBoundary } from '@/components/common/ErrorBoundary/ErrorBoundary';
import { useJudgeLessonWrite } from '@/hooks/lessons/useJudgeLessonWrite';
import { useReviewSession } from '@/hooks/review/useReviewSession';
import { ReviewSessionPage } from '@/pages/ReviewSessionPage/ReviewSessionPage';

type ReviewSessionSearch = {
  mode: 'quick' | 'full';
};

function ReviewSessionRouteComponent() {
  const { mode } = Route.useSearch();
  const {
    currentCard,
    status,
    counts,
    isLoading,
    isError,
    error,
    isRetrying,
    retry,
    isSubmitting,
    presentationSeq,
    currentCardAhead,
    submitReview,
  } = useReviewSession(mode);
  const writeExerciseId =
    currentCard?.lesson_id != null && currentCard.card.type === 'write'
      ? currentCard.card.payload.id
      : null;
  const judgeWrite = useJudgeLessonWrite(
    currentCard?.lesson_id ?? 0,
    writeExerciseId,
  );

  return (
    <ReviewSessionPage
      currentCard={currentCard}
      status={status}
      counts={counts}
      isLoading={isLoading}
      isError={isError}
      error={error}
      isRetrying={isRetrying}
      onRetry={retry}
      isSubmitting={isSubmitting}
      presentationSeq={presentationSeq}
      currentCardAhead={currentCardAhead}
      judgeWrite={judgeWrite}
      submitReview={submitReview}
    />
  );
}

export const Route = createFileRoute('/_reviewSession/review/session')({
  validateSearch: (search): ReviewSessionSearch => ({
    mode: search.mode === 'quick' ? 'quick' : 'full',
  }),
  component: ReviewSessionRouteComponent,
  errorComponent: ({ error, reset }) => (
    <ErrorBoundary
      error={error}
      reset={reset}
      homeTo="/home"
      title="Review failed"
    />
  ),
});
