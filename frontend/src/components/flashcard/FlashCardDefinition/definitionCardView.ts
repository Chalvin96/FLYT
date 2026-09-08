import {
  formatPos,
  getGenderFromTags,
  getLemmaGrammarTag,
} from '@flyt/lexicon/grammar';

import { detectInflectionKind } from '@/components/flashcard/InflectionTable/utils';
import {
  FlashCardType,
  type DefinitionEntry,
  type DefinitionRead,
  type FlashCardRenderable,
  type LemmaPos,
  type WordFormRead,
} from '@/types/api';

export interface DefinitionCardView {
  word: string;
  senseCue: string | null | undefined;
  definitions: DefinitionRead[];
  primaryTranslation: string;
  pos: LemmaPos | undefined;
  inflectionClass: string | null;
  isVerb: boolean;
  gender: string | null;
  formattedPos: string | null;
  ipa: string | null;
  intonation: string | null;
  ipaApproximate: boolean;
  audioUrl: string | null;
}

function buildDefinitionsFromPayload(
  definitions: DefinitionEntry[],
): DefinitionRead[] {
  return definitions.map((d, index) => ({
    uuid: d.uuid,
    id: index,
    definition: d.definition,
    translation: d.translation,
    translation_source: null,
    examples_json: d.examples_json,
  }));
}

/**
 * Derives everything the definition card faces render from the flashcard
 * payload and its word forms. Returns null when the card is not a
 * definition card with at least one renderable definition.
 */
export function buildDefinitionCardView(
  card: FlashCardRenderable,
  wordForms: WordFormRead[],
): DefinitionCardView | null {
  const definitionPayload =
    card.card.type === FlashCardType.DEFINITION ? card.card.payload : null;
  if (!definitionPayload) {
    return null;
  }

  const definitions = buildDefinitionsFromPayload(
    definitionPayload.definitions,
  );
  if (definitions.length === 0) {
    return null;
  }

  const { isNoun, isVerb } = detectInflectionKind(
    wordForms,
    definitionPayload.pos,
  );

  return {
    word: definitionPayload.word,
    senseCue: definitionPayload.sense_cue,
    definitions,
    primaryTranslation: definitionPayload.primary_translation ?? '',
    pos: definitionPayload.pos,
    inflectionClass: definitionPayload.pos
      ? getLemmaGrammarTag(definitionPayload.pos, wordForms)
      : null,
    isVerb,
    gender:
      isNoun && wordForms[0] ? getGenderFromTags(wordForms[0].tags_json) : null,
    formattedPos: definitionPayload.pos
      ? formatPos(definitionPayload.pos)
      : null,
    ipa: definitionPayload.ipa ?? null,
    intonation: definitionPayload.intonation ?? null,
    ipaApproximate: definitionPayload.ipa_approximate ?? false,
    audioUrl: definitionPayload.audio_url ?? wordForms[0]?.audio_url ?? null,
  };
}
