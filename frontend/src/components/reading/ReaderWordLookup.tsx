import {
  buildHeadwordForms,
  DefinitionView,
  normalizeLookupQuery,
  PronunciationRow,
} from '@flyt/lexicon';
import { formatPos } from '@flyt/lexicon/grammar';
import { Badge, Button, Heading, Skeleton, Text } from '@flyt/ui';
import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { isAxiosError } from 'axios';

import { K_LEXICON_BROWSE_QUERY_MIN_LENGTH } from '@/api/lexicon.constants';
import { useChatbot } from '@/components/chatbot/ChatbotProvider';
import { useChatbotOpenState } from '@/components/chatbot/useChatbotOpenState';
import { LemmaCardError } from '@/components/lookup/HomographCard';
import { useLookupContext } from '@/components/lookup/useLookupContext';
import {
  useBrowseHeadword,
  useLemmaActions,
  useLemmaDefinitions,
} from '@/hooks/lexicon/queries';
import { showApiError } from '@/lib/errors';
import { splitTranslation, type SplitTranslation } from '@/lib/translation';
import type {
  ReadingLemmaDefinitionsResponse,
  ReadingWordState,
} from '@/types/api';

import type { ReaderWord } from './readerVocabulary';

const WORD_STATE_LABEL: Record<ReadingWordState, string> = {
  new: 'New word',
  learning: 'Learning',
  mastered: 'Mastered',
};

const LOOKUP_SURFACE =
  'space-y-4 lg:radius-section lg:border lg:border-default lg:bg-raised lg:p-4';

type ReaderLemmaResponse = ReadingLemmaDefinitionsResponse & {
  lemma: ReadingLemmaDefinitionsResponse['lemma'] & {
    compoundParts?: readonly string[];
  };
};

export function ReaderWordLookup({
  word,
  onClose,
}: {
  word: ReaderWord;
  onClose: () => void;
}) {
  const browse = useBrowseHeadword(word.lemmaUuid === null ? word.text : '');
  const entries = browse.data?.entries ?? [];

  if (word.lemmaUuid !== null)
    return (
      <ReaderLemmaDefinition
        key={word.lemmaUuid}
        lemmaUuid={word.lemmaUuid}
        word={word}
        onClose={onClose}
      />
    );
  if (
    browse.isError &&
    !(isAxiosError(browse.error) && browse.error.response?.status === 404)
  )
    return <LemmaCardError onRetry={() => void browse.refetch()} />;
  if (
    (browse.isFetched ||
      normalizeLookupQuery(word.text).length <
        K_LEXICON_BROWSE_QUERY_MIN_LENGTH) &&
    entries.length === 0
  )
    return <MissingReaderDefinition word={word} onClose={onClose} />;
  if (entries.length === 0)
    return (
      <div className="p-5">
        <ReaderLemmaSkeleton />
      </div>
    );
  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
      {entries.map((entry) => (
        <ReaderLemmaDefinition
          key={entry.uuid}
          lemmaUuid={entry.uuid}
          word={word}
          onClose={onClose}
        />
      ))}
    </div>
  );
}

function ReaderLemmaDefinition({
  lemmaUuid,
  word,
  onClose,
}: {
  lemmaUuid: string;
  word: ReaderWord;
  onClose: () => void;
}) {
  const query = useLemmaDefinitions(lemmaUuid);
  if (query.isPending)
    return (
      <div className="p-5">
        <ReaderLemmaSkeleton />
      </div>
    );
  if (query.isError)
    return <LemmaCardError onRetry={() => void query.refetch()} />;
  const data: ReaderLemmaResponse = query.data;
  if (
    !data.lemma.primary_translation &&
    data.definitions.every((definition) => !definition.translation)
  )
    return (
      <MissingReaderDefinition
        word={{ ...word, state: data.definitions[0]?.userState ?? word.state }}
        inDictionary
        onClose={onClose}
      />
    );
  return (
    <ReaderLemmaCard
      key={lemmaUuid}
      data={data}
      lemmaUuid={lemmaUuid}
      word={word}
    />
  );
}

function ReaderLemmaCard({
  data,
  lemmaUuid,
  word,
}: {
  data: ReaderLemmaResponse;
  lemmaUuid: string;
  word: ReaderWord;
}) {
  const { addLemmaToDeck, markLemmaKnown, isPending } =
    useLemmaActions(lemmaUuid);
  const state = data.definitions[0]?.userState ?? word.state;

  return (
    <div className="min-h-0 overflow-y-auto p-5" data-testid="reader-lookup">
      <article className={LOOKUP_SURFACE} data-state={state}>
        <ReaderLemmaHeading data={data} word={word} state={state} />
        <ReaderMeanings definitions={data.definitions} />
        <ReaderRelatedWords entries={data.lemma.see_also} />
        <div className="grid grid-cols-2 gap-3 border-t border-default pt-4">
          <Button
            variant="outline"
            width="full"
            disabled={isPending || state === 'mastered'}
            onClick={() => void markLemmaKnown(lemmaUuid).catch(showApiError)}
          >
            I already know this
          </Button>
          <Button
            width="full"
            disabled={isPending || state === 'learning'}
            onClick={() => void addLemmaToDeck(lemmaUuid).catch(showApiError)}
          >
            {state === 'learning' ? 'Added to review' : 'Add to review'}
          </Button>
        </div>
      </article>
    </div>
  );
}

function ReaderLemmaSkeleton() {
  return (
    <div className={LOOKUP_SURFACE}>
      <Skeleton length="medium" size="sm" variant="heading" />
      <Skeleton length="long" />
      <Skeleton />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton size="sm" variant="control" />
        <Skeleton size="sm" variant="control" />
      </div>
    </div>
  );
}

function ReaderGloss({ translation }: { translation: SplitTranslation }) {
  return (
    <>
      <Heading as="div" size="medium">
        {translation.primary}
      </Heading>
      {translation.alternates.length > 0 && (
        <Text size="small" tone="subtle">
          {translation.alternates.join(' · ')}
        </Text>
      )}
    </>
  );
}

function ReaderLemmaHeading({
  data,
  word,
  state,
}: {
  data: ReaderLemmaResponse;
  word: ReaderWord;
  state: ReadingWordState;
}) {
  const headword =
    data.lemma.primary_display_form ??
    buildHeadwordForms(data.lemma.word).display;
  const parts = data.lemma.compoundParts;
  const display =
    parts && parts.join('') === headword ? parts.join('\u00ad') : headword;
  const translation = splitTranslation(
    data.lemma.primary_translation ?? data.definitions[0]?.translation,
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <Heading
            as="h3"
            size={headword.length > 20 ? 'xlarge' : 'xxlarge'}
            aria-label={headword}
            lang="nb"
          >
            <span className="block hyphens-auto [overflow-wrap:anywhere]">
              {display}
            </span>
          </Heading>
        </div>
        <Badge>{formatPos(data.lemma.pos)}</Badge>
      </div>
      <Badge tone={state === 'mastered' ? 'success' : 'neutral'}>
        {WORD_STATE_LABEL[state]}
      </Badge>
      <PronunciationRow
        ipa={data.lemma.ipa}
        ipaApproximate={data.lemma.ipa_approximate}
        intonation={data.lemma.intonation}
        audioUrl={data.lemma.audio_url}
      />
      {translation && <ReaderGloss translation={translation} />}
      {word.text.toLowerCase() !== headword.toLowerCase() && (
        <Text size="small" tone="subtle" lang="nb">
          {word.text} = {translation?.primary ?? headword}
        </Text>
      )}
      {parts && parts.join('') === headword && (
        <Text size="small" tone="subtle" lang="nb">
          {parts.join(' + ')}
        </Text>
      )}
      {data.lemma.alternative_forms &&
        data.lemma.alternative_forms.length > 0 && (
          <Text size="medium" tone="subtle" lang="nb">
            <Text as="span" weight="semibold">
              Other forms
            </Text>{' '}
            {data.lemma.alternative_forms.join(' · ')}
          </Text>
        )}
    </div>
  );
}

function ReaderMeanings({
  definitions,
}: {
  definitions: ReaderLemmaResponse['definitions'];
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? definitions : definitions.slice(0, 3);
  if (definitions.length === 0) return null;
  return (
    <div className="space-y-4 border-t border-default pt-4">
      {visible.map((definition, index) => (
        <div className="flex min-w-0 gap-3" key={definition.uuid}>
          <Text as="span" size="medium" tone="subtle">
            {index + 1}.
          </Text>
          <div className="min-w-0 flex-1">
            <DefinitionView
              definition={{
                ...definition,
                id: 0,
                examples_json: definition.examples,
              }}
              presentation="lexicon"
              spacing="compact"
              collapsibleExamples
            />
          </div>
        </div>
      ))}
      {visible.length < definitions.length && (
        <Button variant="link" onClick={() => setShowAll(true)}>
          Show all {definitions.length} meanings
        </Button>
      )}
    </div>
  );
}

function ReaderRelatedWords({
  entries,
}: {
  entries: ReaderLemmaResponse['lemma']['see_also'];
}) {
  const { openLemma } = useLookupContext();
  if (!entries || entries.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Text as="span" size="medium" tone="subtle">
        Related:
      </Text>
      {entries.map((entry) =>
        entry.target_lemma_uuid ? (
          <Button
            key={entry.article_id}
            variant="link"
            onClick={() =>
              openLemma(entry.target_lemma_uuid ?? null, entry.word)
            }
          >
            {entry.relation === 'compare' ? 'Compare' : 'See'} {entry.word}
          </Button>
        ) : (
          <Text as="span" key={entry.article_id} size="medium" tone="subtle">
            {entry.relation === 'compare' ? 'Compare' : 'See'} {entry.word}
          </Text>
        ),
      )}
    </div>
  );
}

function MissingReaderDefinition({
  word,
  onClose,
  inDictionary = false,
}: {
  word: ReaderWord;
  onClose: () => void;
  inDictionary?: boolean;
}) {
  const { pin } = useChatbot();
  const { open } = useChatbotOpenState();
  const ask = () => {
    const context = {
      kind: 'selection',
      label: word.text,
      detail: word.sentence,
    } as const;
    pin(context);
    onClose();
    open();
  };
  return (
    <div className="min-h-0 overflow-y-auto p-5" data-testid="reader-lookup">
      <article className={LOOKUP_SURFACE}>
        <Heading as="h3" size="xxlarge" lang="nb">
          {word.text}
        </Heading>
        <Badge>
          {inDictionary
            ? WORD_STATE_LABEL[word.state]
            : 'Not in the dictionary'}
        </Badge>
        <Heading as="h4" size="small">
          No translation found
        </Heading>
        <Text size="medium" tone="subtle">
          {inDictionary
            ? "This dictionary entry doesn't have a translation yet. Flyt can explain it from the sentence."
            : 'It might be a dialect spelling, a name or a typo. Flyt can explain it from the sentence.'}
        </Text>
        {word.sentence && (
          <Text as="blockquote" size="large" lang="nb">
            {word.sentence}
          </Text>
        )}
        <div className="flex flex-col gap-3">
          <Button variant="secondary" width="full" onClick={ask}>
            <Sparkles aria-hidden />
            Ask Flyt what it means
          </Button>
          <Button variant="ghost" width="full" onClick={onClose}>
            Close
          </Button>
        </div>
      </article>
    </div>
  );
}
