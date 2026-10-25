import { Button, Skeleton, Text } from '@flyt/ui';

import { useLemmaDefinitions } from '@/hooks/lexicon/queries';

import { LemmaCard } from './LemmaCard';

export function HomographCard({ lemmaUuid }: { lemmaUuid: string }) {
  const definitionsQuery = useLemmaDefinitions(lemmaUuid);

  if (definitionsQuery.isLoading) {
    return <LemmaCardSkeleton />;
  }
  if (definitionsQuery.isError) {
    return <LemmaCardError onRetry={() => void definitionsQuery.refetch()} />;
  }
  if (definitionsQuery.data) {
    return <LemmaCard data={definitionsQuery.data} lemmaUuid={lemmaUuid} />;
  }
  return null;
}

export function LemmaCardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-3 radius-section border border-default bg-overlay p-4">
        <Skeleton
          data-slot="skeleton"
          length="medium"
          size="sm"
          variant="heading"
        />
        <Skeleton data-slot="skeleton" length="long" />
        <Skeleton data-slot="skeleton" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton data-slot="skeleton" size="sm" variant="control" />
          <Skeleton data-slot="skeleton" size="sm" variant="control" />
        </div>
      </div>
    </div>
  );
}

export function LemmaCardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="space-y-2 p-4">
      <Text as="div" size="medium" tone="subtle">
        <p>Definition unavailable.</p>
        <Button onClick={onRetry} type="button" variant="link">
          Retry
        </Button>
      </Text>
    </div>
  );
}
