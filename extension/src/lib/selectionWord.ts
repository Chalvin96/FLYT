import { isWord } from './word';

export function selectionWord(selected: string): string | null {
  const normalized = selected
    .trim()
    .replace(/^[^\p{L}]+|[^\p{L}\p{M}]+$/gu, '');
  return isWord(normalized) ? normalized : null;
}
