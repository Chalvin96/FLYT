import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Heading,
  Text,
} from '@flyt/ui';
import { AlertCircle, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Link } from '@tanstack/react-router';

import { useImports } from '@/hooks/imports/queries';
import type { ImportItem, ImportQuota } from '@/types/api';

import { groupImports } from './importDisplay';
import { ImportQuotaBadge } from './ImportQuotaBadge';
import { ImportStatusCard } from './ImportStatusCard';
import { ImportTextSheet } from './ImportTextSheet';
import { formatReadingNumber } from './readingDisplay';

export function ImportHomeShelf() {
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const importsQuery = useImports({});
  const items = importsQuery.data?.items ?? [];
  const quota = importsQuery.data?.quota;
  const isAtLimit = quota != null && quota.used >= quota.limit;

  if (importsQuery.isError || importsQuery.isPending) return null;

  return (
    <>
      {items.length === 0 ? (
        <EmptyImportShelf
          isAtLimit={isAtLimit}
          quota={quota}
          onImport={() => setIsPasteOpen(true)}
        />
      ) : (
        <PopulatedImportShelf
          items={items}
          isAtLimit={isAtLimit}
          quota={quota}
          onImport={() => setIsPasteOpen(true)}
        />
      )}
      <ImportTextSheet isOpen={isPasteOpen} onOpenChange={setIsPasteOpen} />
    </>
  );
}

function EmptyImportShelf({
  isAtLimit,
  quota,
  onImport,
}: {
  isAtLimit: boolean;
  quota: ImportQuota | undefined;
  onImport: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-2 radius-field border border-dashed border-strong bg-overlay px-4 py-3">
      <Text as="span" size="medium">
        Have your own Norwegian text?
      </Text>
      <div className="flex flex-col items-start gap-2">
        <Button
          variant="outline"
          onClick={onImport}
          disabled={isAtLimit}
          aria-describedby={isAtLimit ? 'library-imports-quota' : undefined}
        >
          Import it
        </Button>
        {isAtLimit ? (
          <ImportQuotaBadge id="library-imports-quota" quota={quota} />
        ) : null}
      </div>
    </div>
  );
}

function PopulatedImportShelf({
  items,
  isAtLimit,
  quota,
  onImport,
}: {
  items: ImportItem[];
  isAtLimit: boolean;
  quota: ImportQuota | undefined;
  onImport: () => void;
}) {
  const groups = groupImports(items);
  const rows = [...groups.processing, ...groups.ready];
  const rowLimit = groups.failed.length > 0 ? 2 : 3;

  return (
    <Accordion type="single" defaultValue="imports" collapsible>
      <AccordionItem value="imports">
        <div className="flex items-center justify-between gap-3">
          <AccordionTrigger asChild>
            <Button variant="ghost" size="sm">
              <Heading as="span" size="medium">
                Your imports
              </Heading>
              <ChevronDown className="icon-sm" aria-hidden />
            </Button>
          </AccordionTrigger>
          {items.length > 3 ? (
            <Button variant="link" size="sm" asChild>
              <Link to="/reading/imports">
                View all {formatReadingNumber(items.length)}
              </Link>
            </Button>
          ) : null}
        </div>
        <AccordionContent>
          <div className="mt-3 space-y-3">
            {groups.failed.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 radius-field border border-danger-subtle bg-danger-subtle px-3 py-2">
                <AlertCircle className="icon-sm text-icon-danger" aria-hidden />
                <Text as="span" size="medium" tone="danger">
                  {formatReadingNumber(groups.failed.length)}{' '}
                  {groups.failed.length === 1 ? 'import' : 'imports'} failed ·
                </Text>
                <Button variant="link" size="sm" asChild>
                  <Link to="/reading/imports" search={{ status: 'failed' }}>
                    Review
                  </Link>
                </Button>
              </div>
            ) : null}
            {rows.slice(0, rowLimit).map((item) => (
              <ImportStatusCard key={item.id} item={item} />
            ))}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                onClick={onImport}
                disabled={isAtLimit}
                aria-describedby={
                  isAtLimit ? 'library-imports-quota' : undefined
                }
              >
                Import text
              </Button>
              {items.length <= 3 ? (
                <Button variant="link" size="sm" asChild>
                  <Link to="/reading/imports">Manage imports</Link>
                </Button>
              ) : null}
            </div>
            {isAtLimit ? (
              <ImportQuotaBadge id="library-imports-quota" quota={quota} />
            ) : null}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
