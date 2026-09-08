export interface SplitTranslation {
  primary: string;
  alternates: string[];
}

/**
 * MVP translation splitter (see the migrated lexicon-gloss design record).
 *
 * Splits the legacy freeform `primary_translation` string on the literal
 * `' / '` separator into a structured `{primary, alternates}` shape so the
 * UI can render one prominent recall translation plus a compact muted subtitle.
 *
 * `alternates` is capped at 3 entries to match the future structured-gloss
 * contract; the rest of the tail is silently dropped. Trivially replaced by
 * reading the structured column directly once the full rewrite lands.
 */
export function splitTranslation(
  primaryTranslation: string | null | undefined,
): SplitTranslation | null {
  if (!primaryTranslation) return null;

  // TODO: temporary — remove once the structured gloss column ships and the
  // pipeline emits {primary, alternates} directly (the data will change).
  // Until then: separator is the LLM prompt convention ' / ' (space-slash-space),
  // the same literal the backend `_first_gloss()` (flashcards/services.py) splits
  // on — keep the two in sync if either changes. Intentionally NOT a bare '/':
  // that would shred legitimate glosses like "he/she" or "km/h". A no-space dual
  // label therefore stays as a single primary (graceful no-op, never garbage).
  const parts = primaryTranslation
    .split(' / ')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0) return null;

  return {
    primary: parts[0],
    alternates: parts.slice(1, 4),
  };
}
