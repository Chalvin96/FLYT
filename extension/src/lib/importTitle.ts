// Backend's TITLE_MAX_LENGTH (flyt.apps.story_import.constants). Bounding the
// extracted title here keeps a valid long-title article from 422-ing at the
// server's Pydantic max_length.
export const TITLE_MAX_LENGTH = 200;

export function boundImportTitle(
  articleTitle: string | null | undefined,
  documentTitle: string,
): string {
  const raw = articleTitle?.trim() || documentTitle;
  // Code points, not UTF-16 units: a plain slice can halve a surrogate pair.
  return Array.from(raw).slice(0, TITLE_MAX_LENGTH).join("");
}
