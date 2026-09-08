import { ArrowRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from '@tanstack/react-router';

import { Button } from '@/components/common/Button/Button';
import { Skeleton } from '@/components/ui/skeleton';
import { useImports } from '@/hooks/imports/queries';

import { ImportStatusCard } from './ImportStatusCard';
import { ImportTextSheet } from './ImportTextSheet';

export function ImportHomeShelf({ limit = 6 }: { limit?: number }) {
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const importsQuery = useImports({ limit });

  if (importsQuery.isError) {
    return null;
  }

  const items = importsQuery.data?.items ?? [];

  return (
    <section className="space-y-4">
      <ShelfHeader
        onImportClick={() => setIsPasteOpen(true)}
        showViewAll={items.length > 0}
      />

      {importsQuery.isPending ? (
        <div className="flex gap-4 overflow-hidden pb-2" aria-hidden>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-[264px] w-[232px] shrink-0 radius-section sm:h-[292px] sm:w-[280px]"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="radius-field border border-dashed border-border bg-white-100 px-5 py-6 type-caption text-muted-foreground">
          Paste an article, transcript, or notes in Norwegian to read it with
          vocabulary help.
        </p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2 pr-8 scroll-smooth">
          {items.slice(0, limit).map((item) => (
            <ImportStatusCard key={item.id} item={item} variant="shelf" />
          ))}
        </div>
      )}

      <ImportTextSheet isOpen={isPasteOpen} onOpenChange={setIsPasteOpen} />
    </section>
  );
}

function ShelfHeader({
  onImportClick,
  showViewAll,
}: {
  onImportClick: () => void;
  showViewAll: boolean;
}) {
  return (
    <header className="flex items-center justify-between gap-4">
      <h2 className="type-title text-foreground">Your imports</h2>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="default"
          size="sm"
          className="h-9 gap-1"
          onClick={onImportClick}
        >
          <Plus className="icon-sm" aria-hidden />
          Import text
        </Button>
        {showViewAll ? (
          <Button variant="link" asChild>
            <Link to="/reading/imports">
              View all
              <ArrowRight aria-hidden className="icon-sm shrink-0" />
            </Link>
          </Button>
        ) : null}
      </div>
    </header>
  );
}
