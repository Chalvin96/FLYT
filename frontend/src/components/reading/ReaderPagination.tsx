import { Button, Text } from '@flyt/ui';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export interface ReaderPaginationProps {
  requestedPage: number;
  settledPage?: number;
  onPageChange: (page: number) => void;
  onFinish: () => void;
  totalPages: number;
  finishing?: boolean;
}

export function ReaderPagination({
  requestedPage,
  settledPage,
  onPageChange,
  onFinish,
  totalPages,
  finishing = false,
}: ReaderPaginationProps) {
  const isFirst = requestedPage <= 1;
  const isLast = requestedPage >= totalPages;

  return (
    <nav
      aria-label="Story pages"
      className="mx-auto flex w-full max-w-prose items-center gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6"
    >
      <div className="flex min-w-0 flex-1 justify-start">
        {!isFirst && (
          <Button
            type="button"
            variant="outline"
            width="full"
            aria-label="Previous page"
            disabled={finishing}
            onClick={() => onPageChange(requestedPage - 1)}
          >
            <ArrowLeft aria-hidden />
            Previous
          </Button>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center">
        <progress
          aria-label="Story page progress"
          max={totalPages}
          value={settledPage}
          aria-valuetext={
            settledPage === undefined
              ? 'Loading page'
              : `Page ${settledPage} of ${totalPages}`
          }
          className="story-mastery-progress h-1 w-full appearance-none overflow-hidden rounded-full border-0 bg-neutral-subtle"
        />
        <Text as="span" size="medium" tone="subtle">
          Page {requestedPage} of {totalPages}
        </Text>
      </div>
      <div className="flex min-w-0 flex-1 justify-end">
        <Button
          type="button"
          width="full"
          aria-label={isLast ? 'Finish story' : 'Next page'}
          disabled={finishing || (isLast && settledPage === undefined)}
          onClick={() =>
            isLast ? onFinish() : onPageChange(requestedPage + 1)
          }
        >
          {finishing ? 'Finishing…' : isLast ? 'Finish story' : 'Next'}
          {!isLast && <ArrowRight aria-hidden />}
        </Button>
      </div>
      <span
        role="status"
        aria-label="Current story page"
        aria-live="polite"
        className="sr-only"
      >
        {settledPage === undefined
          ? ''
          : `Page ${settledPage} of ${totalPages}`}
      </span>
    </nav>
  );
}
