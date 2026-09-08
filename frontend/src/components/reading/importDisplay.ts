import type { ImportItem } from '@/types/api';

const IMPORT_PUBLISHED_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

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

export const IMPORT_STATUS_CHIP_CLASS_NAMES: Record<ImportCardStatus, string> =
  {
    processing: 'border-warning-30 bg-warning-10 text-warning-100',
    ready: 'border-secondary-40 bg-secondary-10 text-secondary-100',
    failed: 'border-destructive-40 bg-destructive-10 text-destructive-100',
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

export function formatImportShortDate(isoDate: string): string {
  return IMPORT_PUBLISHED_DATE_FORMATTER.format(new Date(isoDate));
}

export function formatImportWordCount(wordCount: number): string {
  const label = wordCount === 1 ? 'word' : 'words';
  return `${wordCount.toLocaleString()} ${label}`;
}

/** Status filter values shown in the UI (one chip per label, plus "All"). */
export const IMPORT_FILTER_VALUES = [
  'all',
  'ready',
  'processing',
  'failed',
] as const;

export type ImportFilterValue = (typeof IMPORT_FILTER_VALUES)[number];

export const IMPORT_FILTER_LABELS: Record<ImportFilterValue, string> = {
  all: 'All',
  ready: 'Ready',
  processing: 'Processing',
  failed: 'Failed',
};

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
  return `${kb.toLocaleString(undefined, {
    maximumFractionDigits: kb < 100 ? 1 : 0,
  })} KB`;
}
