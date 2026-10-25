import { buildHeadwordForms, normalizeLookupQuery } from '@flyt/lexicon';

import {
  useCachedBrowseHeadwords,
  useCachedLemmaDefinitions,
} from '@/hooks/lexicon/queries';

import { mergeStoryLookup, type StoryLookupWord } from './storyCompletion';

export function useStoryLookups(taps: readonly StoryLookupWord[]) {
  const spellings = [
    ...new Set(
      taps
        .filter((word) => word.lemmaUuid === null)
        .map((word) => normalizeLookupQuery(word.text)),
    ),
  ];
  const browse = useCachedBrowseHeadwords(spellings);
  const entriesBySpelling = new Map(
    spellings.map((spelling, index) => [
      spelling,
      browse[index].data?.entries ?? [],
    ]),
  );
  const resolved = taps.flatMap((word) => {
    if (word.lemmaUuid !== null) return [word];
    const entries =
      entriesBySpelling.get(normalizeLookupQuery(word.text)) ?? [];
    return entries.length
      ? entries.map((entry) => ({ ...word, lemmaUuid: entry.uuid }))
      : [word];
  });
  const uuids = [
    ...new Set(
      resolved.flatMap((word) => (word.lemmaUuid ? [word.lemmaUuid] : [])),
    ),
  ];
  const definitions = useCachedLemmaDefinitions(uuids);
  const byUuid = new Map(
    uuids.map((uuid, index) => [uuid, definitions[index]]),
  );
  return resolved.reduce<readonly StoryLookupWord[]>((lookups, word) => {
    const query = word.lemmaUuid ? byUuid.get(word.lemmaUuid) : undefined;
    const data = query?.data;
    const state = data?.definitions[0]?.userState;
    return mergeStoryLookup(
      lookups,
      data
        ? {
            ...word,
            lemmaUuid: data.lemma.uuid,
            dictionaryForm:
              data.lemma.primary_display_form ??
              buildHeadwordForms(data.lemma.word).display,
            state: state ?? word.state,
            observedAt: state ? query.dataUpdatedAt : word.observedAt,
          }
        : word,
    );
  }, []);
}
