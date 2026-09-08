import { getGenderFromTags, getOtherTags } from '@flyt/lexicon/grammar';

import type { LemmaPos, WordFormRead } from '@/types/api';

export type NormalizedPos =
  'noun' | 'adjective' | 'verb' | 'adverb' | undefined;

// Inflection labels are kept full-length by default; only labels that grow past
// a comfortable width collapse to standard Norwegian abbreviations. Short labels
// (presens, positiv, bestemt form, …) render verbatim; long composites
// (presens perfektum, flertall / bestemt form, hankjønn / hunkjønn, …) shorten.
const MAX_INFLECTION_LABEL_LENGTH = 12;

const INFLECTION_ABBR: Record<string, string> = {
  infinitiv: 'inf.',
  presens: 'pres.',
  preteritum: 'pret.',
  perfektum: 'perf.',
  imperativ: 'imp.',
  positiv: 'pos.',
  komparativ: 'komp.',
  superlativ: 'sup.',
  ubestemt: 'ubest.',
  bestemt: 'best.',
  entall: 'ent.',
  flertall: 'flt.',
  hankjønn: 'hank.',
  hunkjønn: 'hunk.',
  intetkjønn: 'intetkj.',
  form: '',
};

export function shortenInflectionLabel(label: string): string {
  if (label.length <= MAX_INFLECTION_LABEL_LENGTH) return label;
  return label
    .split(' ')
    .map((word) => (word in INFLECTION_ABBR ? INFLECTION_ABBR[word] : word))
    .filter((word) => word.length > 0)
    .join(' ');
}

const DEGREE_TAGS = new Set(['Pos', 'Cmp', 'Sup']);
const NOUN_ADJ_TAGS = new Set([
  'Masc',
  'Fem',
  'Neuter',
  'Plur',
  'Def',
  'Sing',
  'Ind',
]);
const VERB_TAGS = new Set(['Inf', 'Pres', 'Past', '<PerfPart>', 'Imp']);

export function hasStructuredInflection(
  wordForms: WordFormRead[],
  pos?: LemmaPos,
): boolean {
  if (wordForms.length === 0) return false;
  const { isNoun, isAdjective, isAdverb, isVerb } = detectInflectionKind(
    wordForms,
    pos,
  );
  return isNoun || isAdjective || isAdverb || isVerb;
}

export function normalizePos(pos?: LemmaPos): NormalizedPos {
  if (!pos) return undefined;

  if (pos === 'noun') return 'noun';
  if (pos === 'adjective') return 'adjective';
  if (pos === 'verb') return 'verb';
  if (pos === 'adverb') return 'adverb';

  return undefined;
}

export function detectInflectionKind(
  wordForms: WordFormRead[],
  pos?: LemmaPos,
) {
  const normalizedPos = normalizePos(pos);

  if (normalizedPos === 'noun') {
    return { isNoun: true, isAdjective: false, isAdverb: false, isVerb: false };
  }
  if (normalizedPos === 'adjective') {
    return { isNoun: false, isAdjective: true, isAdverb: false, isVerb: false };
  }
  if (normalizedPos === 'adverb') {
    return { isNoun: false, isAdjective: false, isAdverb: true, isVerb: false };
  }
  if (normalizedPos === 'verb') {
    return { isNoun: false, isAdjective: false, isAdverb: false, isVerb: true };
  }

  // When the POS is explicitly known but not one of the four inflecting
  // classes (determiner, pronoun, preposition, …), don't force-fit word forms
  // into a noun/adjective/verb grid. A determiner like "det" carries a Neuter
  // gender tag and would otherwise be misdetected as a noun, rendering an empty
  // entall/flertall table. Only guess by tags when POS is genuinely absent or
  // unknown.
  if (pos && pos !== 'unknown') {
    return {
      isNoun: false,
      isAdjective: false,
      isAdverb: false,
      isVerb: false,
    };
  }

  const hasDegreeTags = wordForms.some((wf) =>
    wf.tags_json.some((tag) => DEGREE_TAGS.has(tag)),
  );
  const hasNounAdjTags = wordForms.some((wf) =>
    wf.tags_json.some((tag) => NOUN_ADJ_TAGS.has(tag)),
  );
  const hasVerbTags = wordForms.some((wf) =>
    wf.tags_json.some((tag) => VERB_TAGS.has(tag)),
  );

  const isAdjective = hasDegreeTags && hasNounAdjTags;
  const isAdverb = hasDegreeTags && !hasNounAdjTags;
  const isVerb = hasVerbTags && !hasDegreeTags;
  const isNoun =
    !isAdjective &&
    !isAdverb &&
    !isVerb &&
    wordForms.some((wf) => getGenderFromTags(wf.tags_json));

  return {
    isNoun,
    isAdjective,
    isAdverb,
    isVerb,
  };
}

export interface NounTableModel {
  data: Record<string, Record<string, Record<string, string>>>;
  sortedGenders: string[];
}

export function buildNounTableModel(wordForms: WordFormRead[]): NounTableModel {
  const data: Record<string, Record<string, Record<string, string>>> = {};
  const allGenders = new Set<string>();

  for (const wf of wordForms) {
    const gender = getGenderFromTags(wf.tags_json) || 'Ukjent';
    const tags = getOtherTags(wf.tags_json);
    const number = tags.includes('Plur') ? 'Plural' : 'Singular';
    const definiteness = tags.includes('Def') ? 'Definite' : 'Indefinite';

    if (!data[gender]) data[gender] = {};
    if (!data[gender][number]) data[gender][number] = {};
    data[gender][number][definiteness] = wf.form;
    allGenders.add(gender);
  }

  const genderOrder = ['Masc', 'Fem', 'Neuter', 'Ukjent'];
  const sortedGenders = Array.from(allGenders).sort(
    (a, b) => genderOrder.indexOf(a) - genderOrder.indexOf(b),
  );

  return { data, sortedGenders };
}

export function translateGender(gender: string): string {
  switch (gender) {
    case 'Masc':
      return 'Masculine';
    case 'Fem':
      return 'Feminine';
    case 'Neuter':
      return 'Neuter';
    default:
      return gender;
  }
}

export function translateGenderNo(gender: string): string {
  switch (gender) {
    case 'Masc':
      return 'hankjønn';
    case 'Fem':
      return 'hunkjønn';
    case 'Neuter':
      return 'intetkjønn';
    default:
      return gender;
  }
}

export function getGenderArticle(gender: string): string {
  switch (gender) {
    case 'Masc':
      return 'en\u00a0';
    case 'Fem':
      return 'ei\u00a0';
    case 'Neuter':
      return 'et\u00a0';
    default:
      return '';
  }
}

export function getNounForm(
  data: NounTableModel['data'],
  gender: string,
  number: string,
  definiteness: string,
): string {
  return data[gender]?.[number]?.[definiteness] ?? '—';
}

export function getNounPluralSpan(
  data: NounTableModel['data'],
  sortedGenders: string[],
  genderIndex: number,
  definiteness: 'Indefinite' | 'Definite',
): number {
  const currentGender = sortedGenders[genderIndex];
  const currentForm = getNounForm(data, currentGender, 'Plural', definiteness);

  for (let i = genderIndex - 1; i >= 0; i--) {
    const previousForm = getNounForm(
      data,
      sortedGenders[i],
      'Plural',
      definiteness,
    );
    if (previousForm === currentForm) return 0;
    break;
  }

  let span = 1;
  for (let i = genderIndex + 1; i < sortedGenders.length; i++) {
    if (
      getNounForm(data, sortedGenders[i], 'Plural', definiteness) ===
      currentForm
    ) {
      span += 1;
    } else {
      break;
    }
  }

  return span;
}
