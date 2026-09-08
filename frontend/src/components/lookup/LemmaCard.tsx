import {
  LemmaCardView,
  type LemmaCardData,
  type LemmaRelatedRead,
} from '@flyt/lexicon';

import { useLookupContext } from '@/components/lookup/useLookupContext';
import { useLemmaActions } from '@/hooks/lexicon/queries';
import { showApiError } from '@/lib/errors';
import {
  type ReadingDefinition,
  type ReadingLemmaDefinitionsResponse,
  type SeeAlsoRead,
} from '@/types/api';

interface LemmaCardProps {
  data: ReadingLemmaDefinitionsResponse;
  lemmaUuid: string;
}

function toSharedDefinition(definition: ReadingDefinition) {
  return {
    uuid: definition.uuid,
    id: 0,
    definition: definition.definition,
    translation: definition.translation,
    translation_source: definition.translation_source,
    examples_json: definition.examples,
  };
}

function toSharedRelated(entry: SeeAlsoRead): LemmaRelatedRead {
  return {
    article_id: entry.article_id,
    word: entry.word,
    relation: entry.relation,
    target_lemma_uuid: entry.target_lemma_uuid ?? null,
  };
}

function toSharedLemma(data: ReadingLemmaDefinitionsResponse): LemmaCardData {
  return {
    uuid: data.lemma.uuid,
    word: data.lemma.word,
    pos: data.lemma.pos,
    primary_translation: data.lemma.primary_translation ?? null,
    ipa: data.lemma.ipa ?? null,
    ipa_approximate: data.lemma.ipa_approximate ?? false,
    intonation: data.lemma.intonation ?? null,
    audio_url: data.lemma.audio_url ?? null,
    see_also: data.lemma.see_also?.map(toSharedRelated),
    definitions: data.definitions.map(toSharedDefinition),
  };
}

export function LemmaCard({ data, lemmaUuid }: LemmaCardProps) {
  const { addLemmaToDeck, markLemmaKnown, isPending } =
    useLemmaActions(lemmaUuid);
  const { openLemma } = useLookupContext();
  const lemmaState =
    data.definitions.length > 0 ? data.definitions[0].userState : 'new';

  return (
    <LemmaCardView
      lemma={toSharedLemma(data)}
      state={lemmaState}
      isSubmitting={isPending}
      behavior={{
        showStateLabels: false,
        disableKnowWhenLearning: false,
        disableAddWhenMastered: false,
      }}
      knowLabel="I already know this"
      addLabel="Add to review"
      onMarkKnown={async () => {
        try {
          await markLemmaKnown(lemmaUuid);
        } catch (error) {
          showApiError(error);
        }
      }}
      onAddToReview={async () => {
        try {
          await addLemmaToDeck(lemmaUuid);
        } catch (error) {
          showApiError(error);
        }
      }}
      onSelectRelated={(uuid, word) => openLemma(uuid, word)}
    />
  );
}
