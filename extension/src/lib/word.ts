export const WORD_RE =
  /^\p{L}[\p{L}\p{M}]*(?:[-'’]\p{L}[\p{L}\p{M}]*)*$/u;

export function isWord(s: string): boolean {
  const length = Array.from(s).length;
  return length >= 1 && length <= 40 && WORD_RE.test(s);
}
