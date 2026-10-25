import { Button } from '@flyt/ui';
import { Link } from '@tanstack/react-router';

import { FlashCardLessonEnd } from '@/components/flashcard/FlashCardLessonEnd/FlashCardLessonEnd';
import { useDueCards } from '@/hooks/review/queries';
import { pluralize } from '@/lib/utils';

import {
  LESSON_COMPLETION_DESTINATIONS,
  LESSON_COMPLETION_STATUSES,
  type LessonCompletionDestination,
  type LessonCompletionStatus,
} from './useLessonDetailState';

type LessonCompletionProps = {
  completedCount: number;
  desktopExpanded: boolean;
  completionStatus: LessonCompletionStatus;
  onPrimaryAction: (destination: LessonCompletionDestination) => Promise<void>;
  onRetrySave: () => Promise<boolean>;
};

export function LessonCompletion({
  completedCount,
  desktopExpanded,
  completionStatus,
  onPrimaryAction,
  onRetrySave,
}: LessonCompletionProps) {
  const dueCards = useDueCards(
    'quick',
    completionStatus === LESSON_COMPLETION_STATUSES.saved,
  );
  const hasSaveError = completionStatus === LESSON_COMPLETION_STATUSES.error;
  const isRefreshing = dueCards.fetchStatus !== 'idle';
  const hasQueueError =
    completionStatus === LESSON_COMPLETION_STATUSES.saved &&
    dueCards.isError &&
    !isRefreshing;
  const isLoading =
    completionStatus === LESSON_COMPLETION_STATUSES.pending ||
    dueCards.isPending ||
    isRefreshing;
  const reviewCount = dueCards.data?.length ?? 0;

  async function handlePrimaryAction() {
    if (hasSaveError) {
      await onRetrySave();
    } else if (hasQueueError) {
      await dueCards.refetch();
    } else {
      await onPrimaryAction(
        reviewCount > 0
          ? LESSON_COMPLETION_DESTINATIONS.review
          : LESSON_COMPLETION_DESTINATIONS.home,
      );
    }
  }

  let primaryActionLabel =
    reviewCount > 0 ? `Review ${pluralize(reviewCount, 'card')}` : 'Done';
  if (hasSaveError || hasQueueError) {
    primaryActionLabel = 'Try again';
  } else if (isLoading) {
    primaryActionLabel =
      completionStatus === LESSON_COMPLETION_STATUSES.pending
        ? 'Saving lesson…'
        : 'Loading review…';
  }

  return (
    <FlashCardLessonEnd
      className="w-full"
      desktopExpanded={desktopExpanded}
      completedCount={completedCount}
      hasReviewCards={reviewCount > 0}
      primaryActionLabel={primaryActionLabel}
      secondaryAction={
        <Button asChild variant="link">
          <Link to="/lesson">Back to lessons</Link>
        </Button>
      }
      isSubmitting={isLoading && !hasSaveError && !hasQueueError}
      errorMessage={
        hasSaveError
          ? 'Could not save lesson completion.'
          : hasQueueError
            ? 'Could not load your review queue.'
            : undefined
      }
      onPrimaryAction={() => void handlePrimaryAction()}
    />
  );
}
