import { Text } from '@flyt/ui';
import { Navigate } from '@tanstack/react-router';

import { ErrorMessage } from '@/components/common/ErrorMessage/ErrorMessage';
import { ExerciseHost } from '@/components/flashcard/ExerciseHost';
import type { ReviewSessionState } from '@/hooks/review/useReviewSession';
import type { QueueCounts } from '@/lib/sessionQueue';

import { buildReviewExerciseAdapter } from './reviewExerciseAdapter';
import { ReviewSessionCompletion } from './ReviewSessionCompletion';

interface ReviewSessionPageProps {
  session: ReviewSessionState;
}

export function ReviewSessionPage({ session }: ReviewSessionPageProps) {
  if (session.kind === 'loading') return null;

  if (session.kind === 'empty') {
    return <Navigate replace search={{ mode: 'full' }} to="/review" />;
  }

  if (session.kind === 'error') {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-2xl items-center px-4 py-6">
        <ErrorMessage
          error={session.message}
          title="Could not start review"
          onRetry={() => void session.retry()}
          retryLabel={session.isRetrying ? 'Retrying…' : 'Retry'}
        />
      </div>
    );
  }

  if (session.kind === 'complete') {
    return (
      <ReviewSessionCompletion
        accuracy={session.summary.accuracy}
        reviewedCount={session.summary.reviewedCount}
      />
    );
  }

  return (
    <div className="mx-auto flex h-full min-h-full w-full max-w-3xl flex-col gap-4 pb-3">
      <SessionCountsBar counts={session.counts} />

      {session.ahead ? (
        <div className="flex items-center" data-testid="ahead-signal">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-subtle bg-brand-subtle px-2.5 py-0.5">
            <Text as="span" size="medium" tone="selected">
              Studying ahead
            </Text>
          </span>
        </div>
      ) : null}

      <div className="relative flex min-h-[28rem] flex-1 flex-col md:min-h-[34rem]">
        <ExerciseHost
          adapter={buildReviewExerciseAdapter(session)}
          isSubmitting={session.isSubmitting}
          key={session.presentationKey}
          onFinished={session.submitOutcome}
        />

        {session.isSubmitting ? (
          <div className="absolute inset-0 z-20 bg-transparent" />
        ) : null}
      </div>
    </div>
  );
}

function SessionCountsBar({ counts }: { counts: QueueCounts }) {
  return (
    <div className="flex items-center gap-3">
      <Text data-testid="count-new" size="medium" tone="subtle">
        {counts.new} new
      </Text>
      <Text as="span" size="medium" tone="subtle">
        ·
      </Text>
      <Text data-testid="count-learning" size="medium" tone="subtle">
        {counts.learning} learning
      </Text>
      <Text as="span" size="medium" tone="subtle">
        ·
      </Text>
      <Text data-testid="count-review" size="medium" tone="subtle">
        {counts.review} review
      </Text>
      <div className="flex-1" />
    </div>
  );
}
