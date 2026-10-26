const HAS_TIME_ZONE = /(?:Z|[+-]\d{2}:\d{2})$/i;

export function parseUtcTimestamp(value: string): number {
  return Date.parse(HAS_TIME_ZONE.test(value) ? value : `${value}Z`);
}
