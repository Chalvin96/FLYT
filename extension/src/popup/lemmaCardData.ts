import { type DefinitionRead, type LemmaCardData } from "@flyt/lexicon";
import { toLemmaPos } from "../lib/resolve-types";
import type { LemmaDefinitionsResponse, ResolveCandidate } from "../lib/resolve-types";

export function toLemmaCardData(candidate: ResolveCandidate, detail?: LemmaDefinitionsResponse): LemmaCardData {
  const definitions: DefinitionRead[] = detail
    ? detail.definitions.map((definition, index) => ({
        uuid: definition.uuid,
        id: index,
        definition: definition.definition,
        translation: definition.translation,
        translation_source: definition.translation_source ?? null,
        examples_json: definition.examples,
      }))
    : candidate.definitions.map((definition, index) => ({
        uuid: candidate.lemma_uuid + "-summary-" + index,
        id: index,
        definition: definition.definition,
        translation: definition.translation,
        translation_source: null,
        examples_json: [],
      }));
  const lemma = detail?.lemma;
  return {
    uuid: candidate.lemma_uuid,
    word: lemma?.word ?? candidate.word,
    pos: toLemmaPos(lemma?.pos ?? candidate.pos) ?? "unknown",
    primary_translation: lemma?.primary_translation ?? null,
    ipa: lemma?.ipa ?? candidate.ipa ?? null,
    intonation: lemma?.intonation ?? candidate.intonation ?? null,
    ipa_approximate: lemma?.ipa_approximate ?? candidate.ipa_approximate ?? false,
    audio_url: lemma?.audio_url ?? candidate.audio_url ?? null,
    see_also: lemma?.see_also ?? candidate.see_also ?? [],
    definitions,
  };
}
