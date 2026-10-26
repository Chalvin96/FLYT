import { Button, Heading, IconWell, Skeleton, Text } from '@flyt/ui';
import { Bolt, CircleCheckBig, Inbox, Library, List } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';

import { buildRadioGroupKeyDownHandler } from '@/lib/radioGroupKeyboard';
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

export interface ReviewPageStatus {
  isLoading: boolean;
  isDecksLoading: boolean;
  isAddMoreNewPending: boolean;
}

export interface ReviewPageProps {
  dueCards?: UserCard[];
  initialSelection?: SessionLength;
  status?: ReviewPageStatus;
  onStart?: (mode: SessionLength) => void;
  hasPracticed?: boolean;
  decks?: DeckSummaryItem[];
  subscribingDeckId?: number | null;
  onSubscribeDeck?: (deckId: number) => void;
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
          <Skeleton length="long" size="lg" variant="heading" />
          <div className="mt-8 grid w-full grid-cols-2 gap-3">
            <Skeleton shape="section" variant="block" size="xl" />
            <Skeleton shape="section" variant="block" size="xl" />
          </div>
          <div className="mt-6">
            <Skeleton shape="pill" variant="control" />
          </div>
        </div>
        <div className="mx-auto mt-4 w-full max-w-xs">
          <Button asChild variant="outline" shape="pill" width="full">
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
    return (
      <>
        <div className="mx-auto flex w-full max-w-xs flex-col items-center justify-start gap-6 pt-12 pb-4 text-center">
          <div className="flex w-full flex-col items-center gap-4">
            <IconWell
              size="lg"
              shape="circle"
              tone="neutral"
              icon={CircleCheckBig}
              iconStrokeWidth={1.9}
            />
            <div className="space-y-2">
              <Heading as="h1" size="large" tone="default">
                You&apos;re all caught up
              </Heading>
              <Text size="large" tone="subtle">
                No cards are due right now. Take the win, then keep the rhythm
                going if you&apos;d like.
              </Text>
            </div>
          </div>

          <KeepPracticingPanel
            onAddMoreNew={onAddMoreNew}
            isAddMoreNewPending={isAddMoreNewPending}
          />
        </div>
        {decksSection}
      </>
    );
  }

  if (dueCount === 0) {
    return (
      <>
        <div className="mx-auto flex w-full max-w-xs flex-col items-center justify-start pt-8 gap-4 pb-4 text-center">
          <IconWell tone="brand" icon={Inbox} iconStrokeWidth={1.9} />
          <Heading as="h1" size="large" tone="default">
            Nothing to review yet
          </Heading>
          <Text size="large" tone="subtle">
            Complete a lesson to start building your review queue. Words and
            grammar you learn show up here for spaced-repetition practice.
          </Text>
          <Button asChild shape="pill" width="full">
            <Link to="/lesson">Browse lessons</Link>
          </Button>
        </div>
        <div className="mx-auto mt-4 w-full max-w-xs">
          <Button asChild variant="outline" shape="pill" width="full">
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
        <Heading as="h1" size="large" tone="default">
          How would you like to practice?
        </Heading>

        <div
          aria-label="Session length"
          className="mt-8 grid w-full grid-cols-2 gap-3"
          onKeyDown={buildRadioGroupKeyDownHandler((index) => {
            const value = index === 0 ? 'quick' : 'full';
            setSelectionState({ source: initialSelection, value });
          })}
          role="radiogroup"
        >
          <SessionLengthTile
            title="Quick"
            cardsLabel={pluralize(quickCardCount, 'card')}
            durationLabel={`≈${quickEstimatedMinutes} min`}
            isDisabled={false}
            isSelected={selection === 'quick'}
            tabStop={selection !== 'full'}
            icon={<IconWell tone="brand" icon={Bolt} iconStrokeWidth={2.1} />}
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
            tabStop={selection === 'full'}
            icon={<IconWell tone="neutral" icon={List} iconStrokeWidth={2.1} />}
            onClick={() =>
              setSelectionState({ source: initialSelection, value: 'full' })
            }
          />
        </div>

        <div className="mt-4">
          <Text as="p" size="medium" tone="subtle">
            {counts.new} new · {counts.learning} learning · {counts.review}{' '}
            review
          </Text>
        </div>

        <div className="mt-6">
          <Button
            type="button"
            shape="pill"
            width="full"
            disabled={dueCount === 0}
            onClick={() => onStart?.(selection)}
          >
            Start practice
          </Button>
        </div>

        <div className="mt-2">
          <Button asChild variant="ghost" shape="pill" size="sm" width="full">
            <Link to="/review/cards">
              <Library className="icon-sm" strokeWidth={1.9} />
              My cards
            </Link>
          </Button>
        </div>
      </div>
      {decksSection}
    </>
  );
}
