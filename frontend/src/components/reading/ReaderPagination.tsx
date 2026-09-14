import { Button } from '@/components/common/Button/Button';

import { getReaderEllipsisTarget, getReaderPaginationItems } from './utils';

export interface ReaderPaginationProps {
  requestedPage: number;
  settledPage?: number;
  onPageChange: (page: number) => void;
  totalPages: number;
}

export function ReaderPagination({
  requestedPage,
  settledPage,
  onPageChange,
  totalPages,
}: ReaderPaginationProps) {
  if (totalPages <= 1) return null;

  const isFirst = requestedPage <= 1;
  const isLast = requestedPage >= totalPages;

  return (
    <nav
      aria-label="Story pages"
      className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:flex-nowrap sm:gap-1.5"
    >
      <div className="order-2 flex flex-1 justify-start gap-1 sm:order-1 sm:flex-none">
        <Button
          type="button"
          variant="ghost"
          className="px-3"
          aria-label="First page"
          disabled={isFirst}
          onClick={() => onPageChange(1)}
        >
          First
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="px-3"
          aria-label="Previous page"
          disabled={isFirst}
          onClick={() => onPageChange(requestedPage - 1)}
        >
          &larr; Previous
        </Button>
      </div>

      <div className="order-1 flex w-full flex-wrap items-center justify-center gap-1 sm:order-2 sm:w-auto sm:flex-nowrap">
        {getReaderPaginationItems(requestedPage, totalPages).map((item) =>
          typeof item === 'number' ? (
            <Button
              key={item}
              type="button"
              variant={item === requestedPage ? 'default' : 'ghost'}
              size="icon"
              aria-current={item === requestedPage ? 'page' : undefined}
              aria-label={`Page ${item}`}
              onClick={() => onPageChange(item)}
            >
              {item}
            </Button>
          ) : (
            <Button
              key={item}
              type="button"
              variant="ghost"
              size="icon"
              aria-label={
                item === 'ellipsis-start'
                  ? 'Jump back 3 pages'
                  : 'Jump forward 3 pages'
              }
              onClick={() =>
                onPageChange(
                  getReaderEllipsisTarget(item, requestedPage, totalPages),
                )
              }
            >
              &hellip;
            </Button>
          ),
        )}
      </div>

      <div className="order-3 flex flex-1 justify-end gap-1 sm:flex-none">
        <Button
          type="button"
          variant="ghost"
          className="px-3"
          aria-label="Next page"
          disabled={isLast}
          onClick={() => onPageChange(requestedPage + 1)}
        >
          Next &rarr;
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="px-3"
          aria-label="Last page"
          disabled={isLast}
          onClick={() => onPageChange(totalPages)}
        >
          Last
        </Button>
      </div>
      <span aria-live="polite" className="sr-only">
        {settledPage === undefined
          ? ''
          : `Page ${settledPage} of ${totalPages}`}
      </span>
    </nav>
  );
}
