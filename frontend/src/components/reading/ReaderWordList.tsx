import { buildHeadwordForms } from '@flyt/lexicon';
import { Button, Heading, Text } from '@flyt/ui';
import { useState } from 'react';
import { Link } from '@tanstack/react-router';

import { useLemmaDefinitions } from '@/hooks/lexicon/queries';
import type { ReadingStoryPageResponse } from '@/types/api';

import type { ReaderWord } from './readerVocabulary';
import { getLowerReadingLevel } from './readingLevels';
import { WordSpan } from './WordSpan';

export function EasierStoryNotice({
  newCount,
  story,
  onDismiss,
}: {
  newCount: number;
  story: Pick<
    ReadingStoryPageResponse,
    'cefrLevel' | 'groupKey' | 'groupTitle'
  >;
  onDismiss: () => void;
}) {
  const lowerLevel = getLowerReadingLevel(story.cefrLevel);
  return (
    <div className="space-y-3 radius-section border border-brand-subtle bg-brand-subtle p-4">
      <Heading as="h2" size="xsmall" tone="selected">
        This story is a big step up
      </Heading>
      <Text size="medium" tone="selected">
        {newCount} words on this page are new to you.
      </Text>
      <div className="flex flex-wrap gap-3">
        <Button asChild size="sm">
          {lowerLevel && story.groupKey && story.groupTitle ? (
            <Link
              to="/reading/themes/$key"
              params={{ key: story.groupKey }}
              search={{ levels: [lowerLevel] }}
            >
              Show {lowerLevel} stories in {story.groupTitle}
            </Link>
          ) : (
            <Link to="/reading" search={{}}>
              Browse other stories
            </Link>
          )}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Keep reading
        </Button>
      </div>
    </div>
  );
}

export function ReaderWordList({
  words,
  onSelect,
  easierStoryNotice,
}: {
  words: readonly ReaderWord[];
  onSelect: (word: ReaderWord) => void;
  easierStoryNotice?: React.ReactNode;
}) {
  const newWords = words.filter((word) => word.state === 'new');
  const learningWords = words.filter((word) => word.state === 'learning');
  const allNew = words.length > 0 && newWords.length === words.length;

  if (newWords.length === 0 && learningWords.length === 0) {
    return (
      <div className="flex flex-col gap-4 px-5 py-6">
        {easierStoryNotice}
        <Heading as="h2" size="small">
          {words.length > 0
            ? 'You know every word on this page'
            : 'No dictionary words on this page'}
        </Heading>
        <Text size="medium" tone="subtle">
          You can still select any word to look it up.
        </Text>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-4 px-5 pt-5 pb-3">
        <Heading as="h2" size="small">
          Words on this page
        </Heading>
        <Text size="medium" tone="subtle">
          <span className="hidden lg:inline">
            Click a word to see its meaning.
          </span>
          <span className="lg:hidden">Tap a word to see its meaning.</span>
        </Text>
        {easierStoryNotice}
      </div>
      <div
        className="min-h-0 flex-1 overflow-y-auto px-5 pb-5"
        role="region"
        tabIndex={0}
        aria-label="Page vocabulary"
      >
        {newWords.length > 0 && (
          <ReaderWordGroup
            key={`new-${words[0]?.key}-${words[0]?.text}`}
            label="New"
            words={newWords}
            limit={allNew ? 12 : undefined}
            onSelect={onSelect}
          />
        )}
        {learningWords.length > 0 && (
          <ReaderWordGroup
            key={`learning-${words[0]?.key}-${words[0]?.text}`}
            label="Still learning"
            words={learningWords}
            limit={10}
            onSelect={onSelect}
          />
        )}
        {newWords.length + learningWords.length === 1 && (
          <Text size="medium" tone="subtle">
            Everything else on this page is known to you.
          </Text>
        )}
      </div>
    </div>
  );
}

function ReaderWordGroup({
  label,
  words,
  limit,
  onSelect,
}: {
  label: string;
  words: readonly ReaderWord[];
  limit?: number;
  onSelect: (word: ReaderWord) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible =
    showAll || limit === undefined ? words : words.slice(0, limit);
  return (
    <section className="pb-5">
      <div className="sticky top-0 z-10 flex items-baseline gap-2 bg-raised py-3">
        <Heading as="h3" size="xsmall">
          {label}
        </Heading>
        <Text as="span" size="medium" tone="subtle">
          {words.length}
        </Text>
      </div>
      <Text as="div" size="large">
        <div className="flex flex-wrap gap-x-3 gap-y-3" lang="nb">
          {visible.map((word) => (
            <ReaderWordLabel
              key={word.lemmaUuid}
              word={word}
              onSelect={onSelect}
            />
          ))}
        </div>
      </Text>
      {visible.length < words.length && (
        <div className="mt-3">
          <Button variant="link" onClick={() => setShowAll(true)}>
            Show all {words.length}
          </Button>
        </div>
      )}
    </section>
  );
}

function ReaderWordLabel({
  word,
  onSelect,
}: {
  word: ReaderWord;
  onSelect: (word: ReaderWord) => void;
}) {
  const { data } = useLemmaDefinitions(word.lemmaUuid);
  const headword =
    data?.lemma.primary_display_form ??
    (data ? buildHeadwordForms(data.lemma.word).display : word.text);
  return (
    <WordSpan
      text={headword}
      state={word.state}
      isInteractive
      onClick={() => onSelect(word)}
    />
  );
}
