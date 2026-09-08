export { cn } from '@flyt/ui/lib/utils';

const NUMBER_FORMATTER = new Intl.NumberFormat('en-US');

export function formatNumber(value: number) {
  return NUMBER_FORMATTER.format(Math.max(0, Math.round(value)));
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/** Pluralize a noun against a count, e.g. pluralize(1, 'card') -> "1 card". */
export function pluralize(count: number, singular: string, plural?: string) {
  const word = count === 1 ? singular : (plural ?? `${singular}s`);
  return `${formatNumber(count)} ${word}`;
}

/** Strip inline markdown emphasis (bold/italic/code) for plain-text contexts. */
export function stripInlineMarkdown(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`(.+?)`/g, '$1');
}
