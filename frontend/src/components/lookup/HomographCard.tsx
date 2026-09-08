import { Skeleton } from '@/components/ui/skeleton';
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
      <div className="space-y-3 radius-section border border-border bg-white-100 p-4">
        <Skeleton className="h-6 w-40" data-slot="skeleton" />
        <Skeleton className="h-4 w-56" data-slot="skeleton" />
        <Skeleton className="h-4 w-full" data-slot="skeleton" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-9 w-full" data-slot="skeleton" />
          <Skeleton className="h-9 w-full" data-slot="skeleton" />
        </div>
      </div>
    </div>
  );
}

export function LemmaCardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="space-y-2 p-4 type-caption text-muted-foreground">
      <p>Definition unavailable.</p>
      <button type="button" onClick={onRetry} className="underline">
        Retry
      </button>
    </div>
  );
}
