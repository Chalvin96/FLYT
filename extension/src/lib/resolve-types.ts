import type { LemmaPos } from '@flyt/lexicon';

// Mirrors the backend /lexicons/resolve payload. The ONLY coupling between this
// extension and the backend API contract.
// {query, candidates:[{lemma_uuid, word, pos, hgno, definitions:[{definition, translation}]}]}

const LEMMA_POS_VALUES = new Set<LemmaPos>([
  'noun',
  'adjective',
  'verb',
  'adverb',
  'preposition',
  'conjunction',
  'pronoun',
  'determiner',
  'interjection',
  'numeral',
  'unknown',
]);

// `pos` arrives as a bare string over the wire - narrow it to the shared union at the
// API boundary instead of casting, so an unrecognized value (schema drift) degrades to
// "no pos badge" rather than lying to the type system.
export function toLemmaPos(pos: string): LemmaPos | undefined {
  return LEMMA_POS_VALUES.has(pos as LemmaPos) ? (pos as LemmaPos) : undefined;
}

export interface ResolveDefinition {
  definition: string;
  translation: string;
}

export interface SeeAlsoRead {
  article_id: number;
  word: string;
  relation: string;
  target_lemma_uuid: string | null;
}

export type ResolveState = 'new' | 'learning' | 'known';
export type LemmaState = 'new' | 'learning' | 'mastered';

export interface ResolveCandidate {
  lemma_uuid: string;
  word: string;
  pos: string;
  hgno: number;
  definitions: ResolveDefinition[];
  see_also?: SeeAlsoRead[];
  state?: ResolveState;
  ipa?: string | null;
  intonation?: string | null;
  ipa_approximate?: boolean;
  audio_url?: string | null;
}

export interface ResolveResponse {
  query: string;
  candidates: ResolveCandidate[];
}

export interface LemmaDetailDefinition {
  uuid: string;
  definition: string;
  translation: string;
  translation_source?: string | null;
  examples: { no: string; en: string | null }[];
  userState: LemmaState;
}

export interface LemmaDetail {
  uuid: string;
  word: string;
  pos: string;
  primary_translation?: string | null;
  see_also: SeeAlsoRead[];
  ipa?: string | null;
  intonation?: string | null;
  ipa_approximate?: boolean;
  audio_url?: string | null;
}

export interface LemmaDefinitionsResponse {
  lemma: LemmaDetail;
  definitions: LemmaDetailDefinition[];
}
