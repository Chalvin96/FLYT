import { createFileRoute, useLocation } from '@tanstack/react-router';

import { useReviewSession } from '@/hooks/review/useReviewSession';
import { routeErrorComponent } from '@/lib/routeErrorComponent';
import { ReviewSessionPage } from '@/pages/ReviewSessionPage/ReviewSessionPage';

type ReviewSessionSearch = {
  mode: 'quick' | 'full';
};

function ReviewSessionRouteComponent() {
  const location = useLocation();
  return (
    <ActiveReviewSession
      key={location.state.__TSR_key}
      mode={location.search.mode === 'quick' ? 'quick' : 'full'}
    />
  );
}

function ActiveReviewSession({ mode }: ReviewSessionSearch) {
  const session = useReviewSession(mode);
  return <ReviewSessionPage session={session} />;
}

export const Route = createFileRoute('/_reviewSession/review/session')({
  validateSearch: (search): ReviewSessionSearch => ({
    mode: search.mode === 'quick' ? 'quick' : 'full',
  }),
  component: ReviewSessionRouteComponent,
  errorComponent: routeErrorComponent('Review failed'),
});
