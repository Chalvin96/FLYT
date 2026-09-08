import { CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/common/Button/Button';

export function SessionCompletePanel({
  accuracy,
  hasCardsDueLaterToday,
  onReturnToReview,
  reviewedCount,
}: {
  accuracy: number | null;
  hasCardsDueLaterToday: boolean;
  onReturnToReview: () => void;
  reviewedCount: number;
}) {
  return (
    <div
      aria-label="Review session complete"
      className="container-max mx-auto flex h-full w-full flex-col gap-4 pb-3"
      role="region"
    >
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="radius-section shadow-raised flex min-h-[28rem] w-full flex-col justify-center border border-border bg-card p-8 text-center md:min-h-[34rem]">
          <div className="flex flex-1 flex-col items-center justify-center">
            <div className="mb-6 flex flex-col items-center gap-3">
              <CheckCircle2 className="size-12 text-primary-70" />
              <h1 className="font-display type-title">Session complete</h1>
            </div>

            <div className="space-y-2">
              <p className="type-body text-foreground">
                {reviewedCount} card{reviewedCount === 1 ? '' : 's'} reviewed
              </p>
              <p className="type-body text-foreground">
                {accuracy === null
                  ? 'No graded answers'
                  : `${accuracy}% accuracy`}
              </p>
              {hasCardsDueLaterToday ? (
                <p className="type-caption text-muted-foreground">
                  More cards due later today.
                </p>
              ) : null}
            </div>
          </div>

          <div className="mx-auto mt-auto w-full max-w-72 pt-8">
            <Button className="w-full" onClick={onReturnToReview} type="button">
              Back to review
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
