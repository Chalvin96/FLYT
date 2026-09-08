import { Bolt, CircleCheckBig, Inbox, Library, List } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';

import { Button } from '@/components/common/Button/Button';
import { IconWell } from '@/components/common/IconWell/IconWell';
import { Skeleton } from '@/components/ui/skeleton';
import { getReviewCardCounts } from '@/lib/reviewCounts';
import { pluralize } from '@/lib/utils';
import type { DeckSummaryItem, UserCard } from '@/types/api';
import type { SessionLength } from '@/types/review';
import { QUICK_REVIEW_CARD_COUNT } from '@/types/review';

import { DeckBrowseSection } from './DeckBrowseSection';
import { KeepPracticingPanel } from './KeepPracticingPanel';
import { SessionLengthTile } from './SessionLengthTile';

export { QUICK_REVIEW_CARD_COUNT } from '@/types/review';
export type { SessionLength } from '@/types/review';

/** Async statuses the page surfaces, grouped so callers pass one view state. */
export interface ReviewPageStatus {
  /** Due-card query still loading — renders the skeleton shell. */
  isLoading: boolean;
  /** Deck browse query still loading — renders the deck section skeleton. */
  isDecksLoading: boolean;
  /** "Add more new" promotion mutation in flight. */
  isAddMoreNewPending: boolean;
}

export interface ReviewPageProps {
  dueCards?: UserCard[];
  initialSelection?: SessionLength;
  status?: ReviewPageStatus;
  onStart?: (mode: SessionLength) => void;
  /** True once the learner has practised before — drives a "caught up" empty
   * state instead of the brand-new onboarding one. */
  hasPracticed?: boolean;
  /** Decks available for subscription. Renders the "Word packs" browse
   * section below the practice selector / empty states. */
  decks?: DeckSummaryItem[];
  /** Deck id with a subscribe mutation currently in-flight, or null. */
  subscribingDeckId?: number | null;
  onSubscribeDeck?: (deckId: number) => void;
  /** Called to promote new words into the active due queue. */
  onAddMoreNew?: () => void;
}

const EMPTY_DUE_CARDS: UserCard[] = [];
const EMPTY_DECKS: DeckSummaryItem[] = [];
const DEFAULT_STATUS: ReviewPageStatus = {
  isLoading: false,
  isDecksLoading: false,
  isAddMoreNewPending: false,
};

export function ReviewPage({
  dueCards = EMPTY_DUE_CARDS,
  initialSelection = 'quick',
  status = DEFAULT_STATUS,
  onStart,
  hasPracticed = false,
  decks = EMPTY_DECKS,
  subscribingDeckId = null,
  onSubscribeDeck,
  onAddMoreNew,
}: ReviewPageProps) {
  const { isLoading, isDecksLoading, isAddMoreNewPending } = status;
  const counts = useMemo(() => getReviewCardCounts(dueCards), [dueCards]);
  const dueCount = counts.total;
  const quickCardCount = Math.min(QUICK_REVIEW_CARD_COUNT, dueCount);
  const [selectionState, setSelectionState] = useState<{
    source: SessionLength;
    value: SessionLength;
  }>(() => ({
    source: initialSelection,
    value: initialSelection,
  }));
  const selection =
    selectionState.source === initialSelection
      ? selectionState.value
      : initialSelection;

  const quickEstimatedMinutes = Math.max(1, Math.round(quickCardCount / 2));
  const fullEstimatedMinutes = Math.max(1, Math.round(dueCount / 2));

  const decksSection =
    isDecksLoading || decks.length > 0 ? (
      <DeckBrowseSection
        decks={decks}
        isLoading={isDecksLoading}
        subscribingDeckId={subscribingDeckId}
        onSubscribe={onSubscribeDeck}
      />
    ) : null;

  if (isLoading) {
    return (
      <>
        <div className="mx-auto flex w-full max-w-xs flex-col items-center justify-start pt-8 pb-4 text-center">
          <Skeleton className="h-9 w-56" />
          <div className="mt-8 grid w-full grid-cols-2 gap-3">
            <Skeleton className="radius-section h-44" />
            <Skeleton className="radius-section h-44" />
          </div>
          <Skeleton className="mt-6 h-11 w-full rounded-full" />
        </div>
        <div className="mx-auto mt-4 w-full max-w-xs">
          <Button
            asChild
            variant="outline"
            className="h-10 w-full rounded-full"
          >
            <Link to="/review/cards">
              <Library className="icon-sm" strokeWidth={1.9} />
              My cards
            </Link>
          </Button>
        </div>
        {decksSection}
      </>
    );
  }

  if (dueCount === 0 && hasPracticed) {
    // Caught up: cleared today's queue. Stay positive, offer ways forward.
    return (
      <>
        <div className="mx-auto flex w-full max-w-xs flex-col items-center justify-start gap-6 pt-12 pb-4 text-center">
          <div className="flex w-full flex-col items-center gap-4">
            <IconWell
              size="lg"
              shape="circle"
              tone="secondary"
              icon={CircleCheckBig}
              iconProps={{ strokeWidth: 1.9 }}
            />
            <div className="space-y-2">
              <h1 className="font-display type-title text-foreground">
                You&apos;re all caught up
              </h1>
              <p className="type-body text-muted-foreground">
                No cards are due right now. Take the win, then keep the rhythm
                going if you&apos;d like.
              </p>
            </div>
          </div>

          <KeepPracticingPanel
            onAddMoreNew={onAddMoreNew}
            isAddMoreNewPending={isAddMoreNewPending}
          />

          <div className="w-full text-left">
            <div className="mb-2 px-1 type-caption text-muted-foreground">
              Switch it up
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button asChild variant="outline" className="h-10 rounded-full">
                <Link to="/lesson">Lesson</Link>
              </Button>
              <Button asChild variant="ghost" className="h-10 rounded-full">
                <Link to="/reading">Story</Link>
              </Button>
              <Button asChild variant="ghost" className="h-10 rounded-full">
                <Link to="/review/cards">
                  <Library className="icon-sm" strokeWidth={1.9} />
                  Cards
                </Link>
              </Button>
            </div>
          </div>
        </div>
        {decksSection}
      </>
    );
  }

  if (dueCount === 0) {
    return (
      <>
        <div className="mx-auto flex w-full max-w-xs flex-col items-center justify-start pt-8 gap-4 pb-4 text-center">
          <IconWell
            tone="primary"
            icon={Inbox}
            iconProps={{ strokeWidth: 1.9 }}
          />
          <h1 className="font-display type-title text-foreground">
            Nothing to review yet
          </h1>
          <p className="type-body text-muted-foreground">
            Complete a lesson to start building your review queue. Words and
            grammar you learn show up here for spaced-repetition practice.
          </p>
          <Button asChild className="h-11 w-full rounded-full">
            <Link to="/lesson">Browse lessons</Link>
          </Button>
        </div>
        <div className="mx-auto mt-4 w-full max-w-xs">
          <Button
            asChild
            variant="outline"
            className="h-10 w-full rounded-full"
          >
            <Link to="/review/cards">
              <Library className="icon-sm" strokeWidth={1.9} />
              My cards
            </Link>
          </Button>
        </div>
        {decksSection}
      </>
    );
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-xs flex-col items-center justify-start pt-8 pb-4 text-center">
        <h1 className="font-display type-title text-foreground">
          How would you like to practice?
        </h1>

        <div className="mt-8 grid w-full grid-cols-2 gap-3">
          <SessionLengthTile
            title="Quick"
            cardsLabel={pluralize(quickCardCount, 'card')}
            durationLabel={`≈${quickEstimatedMinutes} min`}
            isDisabled={false}
            isSelected={selection === 'quick'}
            icon={
              <IconWell
                tone="primary"
                icon={Bolt}
                iconProps={{ strokeWidth: 2.1 }}
              />
            }
            onClick={() =>
              setSelectionState({ source: initialSelection, value: 'quick' })
            }
          />

          <SessionLengthTile
            title="Full"
            cardsLabel={pluralize(dueCount, 'card')}
            durationLabel={`≈${fullEstimatedMinutes} min`}
            isDisabled={false}
            isSelected={selection === 'full'}
            icon={
              <IconWell
                tone="secondary"
                icon={List}
                iconProps={{ strokeWidth: 2.1 }}
              />
            }
            onClick={() =>
              setSelectionState({ source: initialSelection, value: 'full' })
            }
          />
        </div>

        <p className="mt-4 type-caption text-muted-foreground">
          {counts.new} new · {counts.learning} learning · {counts.review} review
        </p>

        <Button
          type="button"
          className="mt-6 h-11 w-full rounded-full"
          disabled={dueCount === 0}
          onClick={() => onStart?.(selection)}
        >
          Start practice
        </Button>

        <Button
          asChild
          variant="ghost"
          className="mt-2 h-9 w-full rounded-full text-muted-foreground"
        >
          <Link to="/review/cards">
            <Library className="icon-sm" strokeWidth={1.9} />
            My cards
          </Link>
        </Button>
      </div>
      {decksSection}
    </>
  );
}
