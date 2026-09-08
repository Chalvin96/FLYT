// Pure grammar + Norwegian-character helpers shared by the frontend and the
// extension. No React, no DOM, no app coupling. Lives under `@flyt/lexicon/grammar`
// so both surfaces consume one source.
//
// Frontend re-exports these from `@/utils/grammar` (and `@/utils/validation`
// for `hasValidNorwegianChars`) so existing app import paths keep working.

import type { LemmaPos, WordFormRead } from './types';

const POS_MAP: Record<LemmaPos, string> = {
  noun: 'noun',
  adjective: 'adjective',
  verb: 'verb',
  adverb: 'adverb',
  preposition: 'preposition',
  conjunction: 'conjunction',
  pronoun: 'pronoun',
  determiner: 'determiner',
  interjection: 'interjection',
  numeral: 'numeral',
  unknown: 'unknown',
};

// ── POS → English badge text ────────────────────────────────────────────────
// Design rule: POS + grammatical tags render in ENGLISH (NOUN, VERB, …).

const POS_EN_BADGE: Record<LemmaPos, string> = {
  noun: 'NOUN',
  verb: 'VERB',
  adjective: 'ADJ',
  adverb: 'ADV',
  preposition: 'PREP',
  pronoun: 'PRON',
  conjunction: 'CONJ',
  interjection: 'INTERJ',
  determiner: 'DET',
  numeral: 'NUM',
  unknown: 'UNKNOWN',
};

/** English uppercase badge text for a part of speech (verb → "VERB"). */
export function posLabel(pos: LemmaPos | string): string {
  return POS_EN_BADGE[pos as LemmaPos] ?? String(pos).toUpperCase();
}

const GENDER_TAGS = new Set(['Masc', 'Fem', 'Neuter', 'Masc/Fem']);

const GENDER_LABELS: Record<string, string> = {
  Masc: 'Masculine (en)',
  Fem: 'Feminine (ei)',
  Neuter: 'Neuter (et)',
  'Masc/Fem': 'Masculine or Feminine (en/ei)',
};

const GENDER_SIMPLE_LABELS: Record<string, string> = {
  Masc: 'Masculine',
  Fem: 'Feminine',
  Neuter: 'Neuter',
  'Masc/Fem': 'Masculine/Feminine',
};

const GENDER_ARTICLES: Record<string, string> = {
  Masc: 'en',
  Fem: 'ei',
  Neuter: 'et',
  'Masc/Fem': 'en/ei',
};

export function formatPos(pos: LemmaPos): string {
  return POS_MAP[pos];
}

export function getGenderFromTags(tags: string[]): string | null {
  return tags.find((tag) => GENDER_TAGS.has(tag)) || null;
}

export function formatGender(gender: string): string {
  return GENDER_LABELS[gender] || gender;
}

export function formatGenderSimple(gender: string): string {
  return GENDER_SIMPLE_LABELS[gender] || gender;
}

export function getArticleForGender(gender: string): string {
  return GENDER_ARTICLES[gender] || '?';
}

export function getOtherTags(tags: string[]): string[] {
  return tags.filter((tag) => !GENDER_TAGS.has(tag));
}

export function getInflectionClassLabel(inflectionClass: string): string {
  // Map based on Ordbøkene classes:
  // v1: kaste -> kastet (-et)
  // v2: kjøpe -> kjøpte (-te)
  // v3: leve -> levde (-de)
  // v4: bo -> bodde (-dde)
  // verb: strong/irregular (ta -> tok)
  const map: Record<string, string> = {
    v1: '-et class',
    v2: '-te class',
    v3: '-de class',
    v4: '-dde class',
    verb: 'Strong/Irregular',
  };
  return map[inflectionClass.toLowerCase()] || inflectionClass;
}

export function getLemmaGrammarTag(
  pos: LemmaPos,
  wordForms: WordFormRead[],
): string | null {
  const allTags = wordForms.flatMap((form) => form.tags_json);

  if (pos === 'verb') {
    const verbClassTag = allTags.find((tag) => /^(v[1-4]|verb)$/i.test(tag));
    return verbClassTag ? getInflectionClassLabel(verbClassTag) : null;
  }

  if (pos === 'noun') {
    const nounGender = getGenderFromTags(allTags);
    return nounGender ? formatGenderSimple(nounGender) : null;
  }

  return null;
}

export function hasValidNorwegianChars(text: string): boolean {
  const norwegianRegex = /^[a-zA-ZæøåÆØÅ\s-]+$/;
  return norwegianRegex.test(text);
}
