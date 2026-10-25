import { Button, Heading, Skeleton, Text, textVariants } from '@flyt/ui';
import { Plus, Search, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from '@tanstack/react-router';

import { ErrorMessage } from '@/components/common/ErrorMessage/ErrorMessage';
import {
  getImportCardStatus,
  groupImports,
  type ImportFilterValue,
} from '@/components/reading/importDisplay';
import { ImportListFilters } from '@/components/reading/ImportListFilters';
import { ImportQuotaBadge } from '@/components/reading/ImportQuotaBadge';
import { ImportStatusCard } from '@/components/reading/ImportStatusCard';
import { ImportTextSheet } from '@/components/reading/ImportTextSheet';
import { formatReadingNumber } from '@/components/reading/readingDisplay';
import { useImports } from '@/hooks/imports/queries';
import type { ImportItem } from '@/types/api';

const READY_PAGE_SIZE = 30;
const QUOTA_DESCRIPTION_ID = 'imports-quota';

export interface ReadingImportsPageProps {
  filter: ImportFilterValue;
  q: string | undefined;
  onFilterChange: (filter: ImportFilterValue) => void;
  onSearchChange: (q: string | undefined) => void;
  onClearFilters: () => void;
}

export function ReadingImportsPage(props: ReadingImportsPageProps) {
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const importsQuery = useImports({});
  const items = importsQuery.data?.items ?? [];
  const quota = importsQuery.data?.quota;
  const isAtLimit = quota != null && quota.used >= quota.limit;
  const isEmpty =
    !importsQuery.isPending && !importsQuery.isError && items.length === 0;

  return (
    <div className="container-max mx-auto w-full space-y-6 pb-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Heading as="h1" size="xlarge">
            Your imports
          </Heading>
          <Text as="p" size="medium" tone="subtle">
            Texts you’ve brought into Flyt. Tap a ready text to read it.
          </Text>
        </div>
        {!isEmpty ? (
          <div className="flex max-w-sm flex-col items-start gap-2 sm:items-end">
            <Button
              onClick={() => setIsPasteOpen(true)}
              disabled={isAtLimit || importsQuery.isPending}
              aria-describedby={QUOTA_DESCRIPTION_ID}
            >
              <Plus className="icon-sm" aria-hidden />
              Import
            </Button>
            <ImportQuotaBadge id={QUOTA_DESCRIPTION_ID} quota={quota} />
          </div>
        ) : null}
      </header>

      <ImportsContent
        {...props}
        importsQuery={importsQuery}
        isAtLimit={isAtLimit}
        onImport={() => setIsPasteOpen(true)}
      />
      <ImportTextSheet isOpen={isPasteOpen} onOpenChange={setIsPasteOpen} />
    </div>
  );
}

function ImportsContent({
  importsQuery,
  isAtLimit,
  onImport,
  ...props
}: ReadingImportsPageProps & {
  importsQuery: ReturnType<typeof useImports>;
  isAtLimit: boolean;
  onImport: () => void;
}) {
  if (importsQuery.isPending) {
    return (
      <div aria-label="Loading imports" role="status" className="space-y-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-24">
            <Skeleton shape="section" variant="block" />
          </div>
        ))}
      </div>
    );
  }
  if (importsQuery.isError) {
    return (
      <ErrorMessage
        error="Could not load your imports."
        onRetry={() => void importsQuery.refetch()}
      />
    );
  }
  const items = importsQuery.data?.items ?? [];
  if (items.length === 0) {
    return (
      <FirstTimeEmptyState
        onImportClick={onImport}
        isAtLimit={isAtLimit}
        quota={importsQuery.data?.quota}
      />
    );
  }
  return <LoadedImports items={items} {...props} />;
}

function LoadedImports({
  items,
  filter,
  q,
  onFilterChange,
  onSearchChange,
  onClearFilters,
}: ReadingImportsPageProps & { items: ImportItem[] }) {
  const groups = groupImports(items);
  const counts = {
    all: items.length,
    failed: groups.failed.length,
    processing: groups.processing.length,
    ready: groups.ready.length,
  };
  const visibleItems = collectVisibleImports(items, filter, q);
  const showFilters = items.length > 10 || filter !== 'all' || Boolean(q);

  return (
    <>
      {showFilters ? (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <ImportSearchInput
              value={q ?? ''}
              onChange={(value) => onSearchChange(value || undefined)}
            />
          </div>
          <ImportListFilters
            value={filter}
            onChange={onFilterChange}
            counts={counts}
            className="lg:shrink-0"
          />
        </div>
      ) : null}
      {visibleItems.length === 0 ? (
        <div className="radius-section border border-dashed border-strong bg-overlay px-5 py-8 text-center">
          <Heading as="h2" size="medium">
            No imports match
          </Heading>
          <div className="mt-2">
            <Text as="p" size="medium" tone="subtle">
              Try another title, source, or status.
            </Text>
          </div>
          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={onClearFilters}>
              Clear filters
            </Button>
          </div>
        </div>
      ) : (
        <ImportGroups key={`${filter}:${q ?? ''}`} items={visibleItems} />
      )}
    </>
  );
}

function collectVisibleImports(
  items: ImportItem[],
  filter: ImportFilterValue,
  q: string | undefined,
) {
  const search = q?.trim().toLocaleLowerCase('nb') ?? '';
  return items.filter((item) => {
    const matchesStatus =
      filter === 'all' || getImportCardStatus(item) === filter;
    const matchesSearch =
      !search ||
      `${item.title} ${item.sourceUrl ?? ''}`
        .toLocaleLowerCase('nb')
        .includes(search);
    return matchesStatus && matchesSearch;
  });
}

function ImportGroups({ items }: { items: ImportItem[] }) {
  const [readyLimit, setReadyLimit] = useState(READY_PAGE_SIZE);
  const groups = groupImports(items);
  const moreCount = Math.min(READY_PAGE_SIZE, groups.ready.length - readyLimit);

  return (
    <div className="space-y-8">
      <ImportGroup title="Needs attention" items={groups.failed} />
      <ImportGroup title="Processing" items={groups.processing} />
      <ImportGroup
        title="Ready"
        items={groups.ready.slice(0, readyLimit)}
        count={groups.ready.length}
      />
      {moreCount > 0 ? (
        <div className="flex flex-col items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setReadyLimit((limit) => limit + READY_PAGE_SIZE)}
          >
            Show {formatReadingNumber(moreCount)} more
          </Button>
          <Text as="p" size="small" tone="subtle">
            Showing {formatReadingNumber(readyLimit)} of{' '}
            {formatReadingNumber(groups.ready.length)} ready texts
          </Text>
        </div>
      ) : null}
    </div>
  );
}

function ImportGroup({
  title,
  items,
  count = items.length,
}: {
  title: string;
  items: ImportItem[];
  count?: number;
}) {
  if (items.length === 0) return null;
  return (
    <section aria-label={title} className="space-y-3">
      <div className="flex items-baseline gap-2">
        <Heading as="h2" size="medium">
          {title}
        </Heading>
        <Text as="span" size="medium" tone="subtle">
          · {formatReadingNumber(count)}
        </Text>
      </div>
      <div className="grid items-start gap-3 lg:grid-cols-2">
        {items.map((item) => (
          <ImportStatusCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

function FirstTimeEmptyState({
  onImportClick,
  isAtLimit,
  quota,
}: {
  onImportClick: () => void;
  isAtLimit: boolean;
  quota: React.ComponentProps<typeof ImportQuotaBadge>['quota'];
}) {
  return (
    <div className="radius-section border border-dashed border-strong bg-overlay px-6 py-10 text-center">
      <Heading as="h2" size="medium">
        Bring your own Norwegian text
      </Heading>
      <div className="mx-auto mt-2 max-w-[44ch]">
        <Text as="p" size="medium" tone="subtle">
          Paste an article, a transcript, or your notes. Flyt turns it into a
          text you can tap through, with your vocabulary highlighted.
        </Text>
      </div>
      <div className="mt-5 flex flex-col items-center gap-3">
        <Button
          onClick={onImportClick}
          disabled={isAtLimit}
          aria-describedby={isAtLimit ? QUOTA_DESCRIPTION_ID : undefined}
        >
          <Plus className="icon-sm" aria-hidden />
          Import text
        </Button>
        <ImportQuotaBadge id={QUOTA_DESCRIPTION_ID} quota={quota} />
        <Text as="p" size="small" tone="subtle">
          Or use the{' '}
          <Link
            to="/reading/imports/install"
            className="text-brand underline underline-offset-2"
          >
            browser extension
          </Link>{' '}
          to import pages as you read.
        </Text>
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
    <div className="relative flex h-11 items-center radius-field border border-default bg-overlay">
      <Search
        className="icon-sm absolute left-3 text-icon-default"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search by title or source"
        aria-label="Search your imports"
        className={`h-full w-full radius-field bg-transparent pl-10 pr-12 placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focused)] ${textVariants({ size: 'medium', tone: 'default' })}`}
      />
      {value.length > 0 ? (
        <span className="absolute right-1 flex">
          <Button
            aria-label="Clear search"
            onClick={() => onChange('')}
            shape="pill"
            size="icon-sm"
            variant="ghost"
          >
            <X />
          </Button>
        </span>
      ) : null}
    </div>
  );
}
