import { Button, Heading, Text } from '@flyt/ui';
import { CheckCircle2 } from 'lucide-react';

import { ErrorMessage } from '@/components/common/ErrorMessage/ErrorMessage';
import { pluralize } from '@/lib/utils';
import {
  KeepPracticingPanel,
  type KeepPracticingPanelProps,
} from '@/pages/ReviewPage/KeepPracticingPanel';

export type ReviewCompletionNextStep =
  | { kind: 'loading' }
  | { kind: 'error'; onRetry: () => void }
  | { kind: 'ready'; dueNowCount: number; hasCardsDueLaterToday: boolean };

interface SessionCompletePanelProps extends KeepPracticingPanelProps {
  accuracy: number | null;
  nextStep: ReviewCompletionNextStep;
  onContinueReviewing: () => void;
  onReturnHome: () => void;
  reviewedCount: number;
}

export function SessionCompletePanel({
  accuracy,
  nextStep,
  onContinueReviewing,
  onReturnHome,
  reviewedCount,
  onAddMoreNew,
  isAddMoreNewPending,
}: SessionCompletePanelProps) {
  const isCaughtUp = nextStep.kind === 'ready' && nextStep.dueNowCount === 0;
  const dueHint = getDueHint(nextStep);

  return (
    <div
      aria-label="Review session complete"
      className="mx-auto flex w-full max-w-md flex-col items-center gap-8 py-8 text-center sm:py-12"
      role="region"
    >
      <div className="flex w-full flex-col items-center gap-3">
        <CheckCircle2 aria-hidden="true" className="size-12 text-icon-brand" />
        <Heading as="h1" size="large">
          {isCaughtUp ? "You're all caught up" : 'Session complete'}
        </Heading>
        <Text size="large" tone="default">
          {pluralize(reviewedCount, 'card')} reviewed ·{' '}
          {accuracy === null ? 'No graded answers' : `${accuracy}% accuracy`}
        </Text>
        {dueHint ? (
          <Text size="medium" tone="subtle">
            {dueHint}
          </Text>
        ) : null}
      </div>

      {nextStep.kind === 'loading' ? (
        <div role="status">
          <Text size="medium" tone="subtle">
            Checking your review queue…
          </Text>
        </div>
      ) : nextStep.kind === 'error' ? (
        <ErrorMessage
          error="Try again to see what is due next."
          title="Could not load your review queue"
          onRetry={nextStep.onRetry}
        />
      ) : isCaughtUp ? (
        <KeepPracticingPanel
          onAddMoreNew={onAddMoreNew}
          isAddMoreNewPending={isAddMoreNewPending}
        />
      ) : (
        <div className="flex w-full flex-col gap-2">
          <Button
            width="full"
            shape="pill"
            variant="primary"
            onClick={onContinueReviewing}
            type="button"
          >
            Continue reviewing
          </Button>
          <Button
            width="full"
            shape="pill"
            variant="ghost"
            onClick={onReturnHome}
            type="button"
          >
            Back to Home
          </Button>
        </div>
      )}
    </div>
  );
}

function getDueHint(nextStep: ReviewCompletionNextStep): string | null {
  if (nextStep.kind !== 'ready') return null;
  if (nextStep.dueNowCount > 0) {
    return `${pluralize(nextStep.dueNowCount, 'card')} due now${nextStep.hasCardsDueLaterToday ? ' · more later today' : ''}`;
  }
  return nextStep.hasCardsDueLaterToday
    ? 'Nothing due now · more cards later today'
    : null;
}
