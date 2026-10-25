export const READER_FIRST_PAGE = 1;

export function parseReaderPage(value: unknown): number | undefined {
  const page = typeof value === 'string' ? Number(value) : value;
  if (typeof page !== 'number' || !Number.isInteger(page) || page < 1) {
    return undefined;
  }
  return page;
}
