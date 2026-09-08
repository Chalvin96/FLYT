import { ArrowLeft, Plus, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';

import { Button } from '@/components/common/Button/Button';
import { ErrorMessage } from '@/components/common/ErrorMessage/ErrorMessage';
import {
  IMPORT_FILTER_LABELS,
  type ImportFilterValue,
} from '@/components/reading/importDisplay';
import { ImportListFilters } from '@/components/reading/ImportListFilters';
import { ImportQuotaBadge } from '@/components/reading/ImportQuotaBadge';
import { ImportStatusCard } from '@/components/reading/ImportStatusCard';
import { ImportTextSheet } from '@/components/reading/ImportTextSheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useImports } from '@/hooks/imports/queries';
import { cn } from '@/lib/utils';
import { type ImportStatusFilter } from '@/types/api';

const EXTENSION_INSTALL_ROUTE = '/reading/imports/install';

const FILTER_TO_STATUS: Record<
  Exclude<ImportFilterValue, 'all'>,
  ImportStatusFilter
> = {
  ready: 'ready',
  processing: 'processing',
  failed: 'failed',
};

const FILTER_DEBOUNCE_MS = 250;

export interface ReadingImportsPageProps {
  filter: ImportFilterValue;
  q: string | undefined;
  onFilterChange: (filter: ImportFilterValue) => void;
  onSearchChange: (q: string | undefined) => void;
}

export function ReadingImportsPage({
  filter,
  q: qProp,
  onFilterChange,
  onSearchChange,
}: ReadingImportsPageProps) {
  const [isPasteOpen, setIsPasteOpen] = useState(false);

  // Local input mirrors the URL `q` param.
  const [searchInput, setSearchInput] = useState(qProp ?? '');
  if (qProp !== undefined && searchInput.trim() !== qProp) {
    setSearchInput(qProp);
  }

  // A timer outliving the page would navigate after unmount.
  const searchTimerRef = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(searchTimerRef.current), []);

  const handleSearchInput = (value: string) => {
    setSearchInput(value);
    window.clearTimeout(searchTimerRef.current);
    searchTimerRef.current = window.setTimeout(
      () => onSearchChange(value.trim() || undefined),
      FILTER_DEBOUNCE_MS,
    );
  };

  const status = filter === 'all' ? undefined : FILTER_TO_STATUS[filter];
  const q = qProp?.trim() || undefined;

  const importsQuery = useImports({ status, q });

  const items = importsQuery.data?.items ?? [];
  const quota = importsQuery.data?.quota;

  const isInitialPending = importsQuery.isPending;
  const isInitialError = importsQuery.isError;

  if (isInitialPending) {
    return (
      <div
        className="container-max mx-auto w-full space-y-6 pb-10"
        aria-label="Loading imports"
      >
        <ImportsPageHeader
          onImportClick={() => setIsPasteOpen(true)}
          quota={undefined}
        />
        <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(258px,1fr))]">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[296px] radius-section" />
          ))}
        </div>
        <ImportTextSheet isOpen={isPasteOpen} onOpenChange={setIsPasteOpen} />
      </div>
    );
  }

  if (isInitialError) {
    return (
      <div className="container-max mx-auto w-full space-y-6 pb-10">
        <ImportsPageHeader
          onImportClick={() => setIsPasteOpen(true)}
          quota={undefined}
        />
        <ErrorMessage
          error="Could not load your imports."
          onRetry={() => void importsQuery.refetch()}
        />
        <ImportTextSheet isOpen={isPasteOpen} onOpenChange={setIsPasteOpen} />
      </div>
    );
  }

  // First-time empty state.
  const isTotalEmpty = items.length === 0 && filter === 'all' && !q;

  return (
    <div className="container-max mx-auto w-full space-y-5 pb-10">
      <ImportsPageHeader
        onImportClick={() => setIsPasteOpen(true)}
        quota={quota}
      />

      {isTotalEmpty ? (
        <FirstTimeEmptyState onImportClick={() => setIsPasteOpen(true)} />
      ) : (
        <>
          <ImportSearchInput value={searchInput} onChange={handleSearchInput} />

          <ImportListFilters value={filter} onChange={onFilterChange} />

          {items.length === 0 ? (
            <div className="radius-field border border-border bg-white-100 px-5 py-8 text-center type-caption text-muted-foreground">
              No imports match{' '}
              {q
                ? `"${q}"`
                : `the ${IMPORT_FILTER_LABELS[filter].toLowerCase()} filter`}
              .
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(258px,1fr))]">
              {items.map((item) => (
                <ImportStatusCard key={item.id} item={item} variant="grid" />
              ))}
            </div>
          )}
        </>
      )}

      <ImportTextSheet isOpen={isPasteOpen} onOpenChange={setIsPasteOpen} />
    </div>
  );
}

function ImportsPageHeader({
  onImportClick,
  quota,
}: {
  onImportClick: () => void;
  quota: React.ComponentProps<typeof ImportQuotaBadge>['quota'];
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <Link
          to="/reading"
          className="inline-flex items-center gap-1 type-caption-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="icon-sm" aria-hidden />
          Reading
        </Link>
        <h1 className="font-display type-title font-semibold text-foreground">
          Your imports
        </h1>
        <p className="type-caption text-muted-foreground">
          Texts you&apos;ve imported. Tap a ready text to read it.
        </p>
      </div>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <Button
          type="button"
          size="sm"
          className="h-9 gap-1"
          onClick={onImportClick}
        >
          <Plus className="icon-sm" aria-hidden />
          Import text
        </Button>
        <ImportQuotaBadge quota={quota} />
      </div>
    </header>
  );
}

function FirstTimeEmptyState({ onImportClick }: { onImportClick: () => void }) {
  return (
    <div className="radius-section border border-dashed border-border bg-white-100 px-6 py-10 text-center">
      <h2 className="font-display type-section font-semibold text-foreground">
        Import your first text
      </h2>
      <p className="mx-auto mt-2 max-w-[44ch] type-caption text-muted-foreground">
        Paste any Norwegian text — an article, a transcript, notes — and
        we&apos;ll turn it into a tap-to-read text with your vocabulary
        highlighted.
      </p>
      <div className="mt-4 flex flex-col items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="h-9 gap-1"
          onClick={onImportClick}
        >
          <Plus className="icon-sm" aria-hidden />
          Import text
        </Button>
        <p className="type-caption-sm text-muted-foreground">
          Or{' '}
          <Link
            to={EXTENSION_INSTALL_ROUTE}
            className="font-semibold text-primary-70 hover:text-primary-80"
          >
            install the browser extension
          </Link>{' '}
          to import pages as you read.
        </p>
      </div>
    </div>
  );
}

function ImportSearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      className={cn(
        'relative flex h-9 items-center radius-field border border-secondary-20 bg-white-100',
      )}
    >
      <Search
        className="icon-sm absolute left-3 text-secondary-60"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by title or source"
        aria-label="Search your imports"
        className="h-full w-full bg-transparent pl-10 pr-9 type-caption text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {value.length > 0 ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 flex size-6 items-center justify-center text-secondary-60 hover:text-secondary-80"
          aria-label="Clear search"
        >
          <X className="icon-sm" />
        </button>
      ) : null}
    </div>
  );
}
