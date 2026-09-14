export const READER_FIRST_PAGE = 1;

export const READER_ELLIPSIS_JUMP = 3;

const MAX_UNELIDED_PAGES = 7;

export type ReaderPaginationItem = number | 'ellipsis-start' | 'ellipsis-end';

export function parseReaderPage(value: unknown): number | undefined {
  const page = typeof value === 'string' ? Number(value) : value;
  if (typeof page !== 'number' || !Number.isInteger(page) || page < 1) {
    return undefined;
  }
  return page;
}

export function getReaderPaginationItems(
  currentPage: number,
  totalPages: number,
): ReaderPaginationItem[] {
  if (totalPages <= MAX_UNELIDED_PAGES) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis-end', totalPages];
  }
  if (currentPage >= totalPages - 3) {
    return [
      1,
      'ellipsis-start',
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }
  return [
    1,
    'ellipsis-start',
    currentPage - 1,
    currentPage,
    currentPage + 1,
    'ellipsis-end',
    totalPages,
  ];
}

export function getReaderEllipsisTarget(
  item: 'ellipsis-start' | 'ellipsis-end',
  currentPage: number,
  totalPages: number,
): number {
  return item === 'ellipsis-start'
    ? Math.max(READER_FIRST_PAGE, currentPage - READER_ELLIPSIS_JUMP)
    : Math.min(totalPages, currentPage + READER_ELLIPSIS_JUMP);
}
