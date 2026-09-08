import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { useDashboardStats } from '@/hooks/dashboard/queries';
import {
  useAddMoreNew,
  useDecks,
  useDueCards,
  useSubscribeToDeck,
} from '@/hooks/review/queries';
import { ReviewPage } from '@/pages/ReviewPage/ReviewPage';

type ReviewPageSearch = {
  mode: 'quick' | 'full';
};

function ReviewIndexRouteComponent() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { data: dueCards, isPending: isLoading } = useDueCards();
  const { data: stats } = useDashboardStats();
  const hasPracticed = (stats?.wordsPracticed ?? 0) > 0;
  const { data: decks, isPending: isDecksPending } = useDecks();
  const { subscribeToDeck, subscribingDeckId } = useSubscribeToDeck();
  const { addMoreNew, isPending: isAddMoreNewPending } = useAddMoreNew();

  return (
    <ReviewPage
      dueCards={dueCards}
      initialSelection={mode}
      status={{
        isLoading,
        isDecksLoading: isDecksPending,
        isAddMoreNewPending,
      }}
      hasPracticed={hasPracticed}
      onStart={(selection) => {
        void navigate({
          to: '/review/session',
          search: { mode: selection },
        });
      }}
      onAddMoreNew={addMoreNew}
      decks={decks}
      subscribingDeckId={subscribingDeckId}
      onSubscribeDeck={(deckId) => void subscribeToDeck(deckId).catch(() => {})}
    />
  );
}

export const Route = createFileRoute('/_shell/review/')({
  validateSearch: (search): ReviewPageSearch => ({
    mode: search.mode === 'quick' ? 'quick' : 'full',
  }),
  component: ReviewIndexRouteComponent,
});
