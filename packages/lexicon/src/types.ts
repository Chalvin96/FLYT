// Shared lexicon types consumed by both the frontend and the extension.
// These mirror the backend lemma/definition/word-form read shapes. Only the
// pure presentational subset lives here; app-only types stay in the frontend.

export type LemmaPos =
  | 'noun'
  | 'adjective'
  | 'verb'
  | 'adverb'
  | 'preposition'
  | 'conjunction'
  | 'pronoun'
  | 'determiner'
  | 'interjection'
  | 'numeral'
  | 'unknown';

/**
 * A bilingual example sentence: Norwegian source + optional English gloss.
 * `en` is `null` when no translation is available yet (dual-read window during
 * the schema-v3 rollout — legacy bare-string examples lift to this).
 */
export interface ExamplePair {
  no: string;
  en: string | null;
}

export interface DefinitionRead {
  uuid: string;
  id: number;
  definition: string;
  translation: string;
  translation_source: string | null;
  examples_json: ExamplePair[];
}

export type LemmaActionState = 'new' | 'learning' | 'mastered';

export type LemmaAction = 'know' | 'add';

export interface LemmaRelatedRead {
  article_id: number;
  word: string;
  relation: string;
  target_lemma_uuid: string | null;
}

export interface LemmaCardData {
  uuid: string;
  word: string;
  pos: LemmaPos;
  primary_translation?: string | null;
  ipa?: string | null;
  intonation?: string | null;
  ipa_approximate?: boolean;
  audio_url?: string | null;
  see_also?: LemmaRelatedRead[];
  definitions: DefinitionRead[];
}

export interface WordFormRead {
  id: number;
  form: string;
  tags_json: string[];
  ipa: string | null;
  audio_url: string | null;
  ipa_approximate: boolean;
}
