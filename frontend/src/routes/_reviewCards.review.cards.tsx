import { createFileRoute } from '@tanstack/react-router';

import { ReviewCardsRouteComponent } from '@/pages/WordsPage/ReviewCardsRouteComponent';

export const Route = createFileRoute('/_reviewCards/review/cards')({
  component: ReviewCardsRouteComponent,
});
