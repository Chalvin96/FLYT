import type { ImportItem } from '@/types/api';
import { parseUtcTimestamp } from '@/utils/date';

export type ImportCardStatus = 'processing' | 'ready' | 'failed';

export function getImportCardStatus(item: ImportItem): ImportCardStatus {
  if (item.status === 'ready') return 'ready';
  if (item.status === 'failed') return 'failed';
  return 'processing';
}

export const IMPORT_STATUS_LABELS: Record<ImportCardStatus, string> = {
  processing: 'Processing',
  ready: 'Ready',
  failed: 'Failed',
};

export function getImportCoverLabel(item: ImportItem): string {
  if (item.sourceUrl) {
    try {
      const host = new URL(item.sourceUrl).hostname;
      return host.replace(/^www\./, '');
    } catch {
      return item.sourceUrl;
    }
  }
  return 'Pasted';
}

export const IMPORT_FILTER_VALUES = [
  'all',
  'failed',
  'processing',
  'ready',
] as const;

export type ImportFilterValue = (typeof IMPORT_FILTER_VALUES)[number];

export const IMPORT_FILTER_LABELS: Record<ImportFilterValue, string> = {
  all: 'All',
  ready: 'Ready',
  processing: 'Processing',
  failed: 'Failed',
};

export function groupImports(items: ImportItem[]) {
  const sorted = [...items].sort(
    (left, right) =>
      parseUtcTimestamp(right.createdAt) - parseUtcTimestamp(left.createdAt),
  );
  return {
    failed: sorted.filter((item) => item.status === 'failed'),
    processing: sorted.filter(
      (item) => getImportCardStatus(item) === 'processing',
    ),
    ready: sorted.filter((item) => item.status === 'ready'),
  };
}

export function normalizeImportText(text: string): string {
  let normalized = text.normalize('NFC');
  normalized = normalized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  normalized = normalized
    .split('\n')
    .map((line) => line.replace(/\s+$/u, ''))
    .join('\n');
  normalized = normalized.replace(/\n{3,}/g, '\n\n');
  return normalized.trim();
}

export function getImportTextByteCount(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function formatKilobytes(bytes: number): string {
  const kb = bytes / 1024;
  if (kb >= 1024) {
    const mb = kb / 1024;
    return `${mb.toLocaleString(undefined, {
      maximumFractionDigits: 1,
    })} MB`;
  }
  return `${kb.toLocaleString(undefined, {
    maximumFractionDigits: kb < 100 ? 1 : 0,
  })} KB`;
}
