import { Badge, Button, Heading, Row, Text } from '@flyt/ui';
import { Check, ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from '@tanstack/react-router';

import {
  formatReadingMinutesPhrase,
  getCefrBadgeTone,
} from '@/components/reading/readingDisplay';
import type {
  AddLemmasRequest,
  AddLemmasResult,
} from '@/hooks/lexicon/queries';
import { useIsDesktop } from '@/hooks/ui/useIsDesktop';
import type {
  ReadingGroup,
  ReadingStoryPageResponse,
  ReadingStorySummary,
} from '@/types/api';

import type {
  StoryContinuation,
  StoryLookupWord,
  StoryVocabulary,
} from './storyCompletion';
import { useStoryWordReview, type ReviewAddition } from './useStoryWordReview';

export interface StoryEndSectionProps {
  story: Pick<
    ReadingStoryPageResponse,
    | 'title'
    | 'cefrLevel'
    | 'groupKey'
    | 'groupTitle'
    | 'totalPages'
    | 'readingMinutes'
  >;
  wordCount?: number;
  vocabulary?: StoryVocabulary;
  lookups: readonly StoryLookupWord[];
  continuation: StoryContinuation;
  otherThemes: readonly ReadingGroup[];
  recommendations: readonly ReadingStorySummary[];
  onLookup: (word: StoryLookupWord) => void;
  onAddWords: (request: AddLemmasRequest) => Promise<AddLemmasResult>;
}

export function StoryEndSection({
  story,
  wordCount,
  vocabulary,
  lookups,
  continuation,
  otherThemes,
  recommendations,
  onLookup,
  onAddWords,
}: StoryEndSectionProps) {
  const isImport = story.groupKey === null;
  const hasVocabulary =
    vocabulary !== undefined &&
    vocabulary.mastered + vocabulary.learning + vocabulary.new > 0;
  const hasRecap = hasVocabulary || lookups.length > 0;
  const nextUuid =
    continuation.kind === 'next' ? continuation.story.uuid : undefined;
  const more = recommendations
    .filter((candidate) => candidate.uuid !== nextUuid)
    .slice(0, 3);
  return (
    <section className="space-y-6" aria-labelledby="story-finished-title">
      <StoryCompletionHeader story={story} wordCount={wordCount} />
      <div
        className="grid items-start gap-6 lg:grid-cols-5 lg:gap-10"
        data-testid="story-end-blocks"
      >
        {hasRecap && (
          <StoryRecap
            vocabulary={vocabulary}
            lookups={lookups}
            onLookup={onLookup}
            onAddWords={onAddWords}
          />
        )}
        <div
          className={
            hasRecap
              ? 'min-w-0 space-y-6 lg:col-span-2 lg:space-y-7'
              : 'min-w-0 space-y-6 lg:col-span-5 lg:max-w-prose'
          }
        >
          {!isImport && continuation.kind === 'next' && (
            <NextStory theme={continuation.theme} story={continuation.story} />
          )}
          {!isImport && continuation.kind === 'last' && (
            <ThemeEnd continuation={continuation} otherThemes={otherThemes} />
          )}
          {more.length > 0 && (
            <section className="space-y-3" aria-labelledby="story-more-to-read">
              <Heading as="h2" id="story-more-to-read" size="small">
                More to read
              </Heading>
              <div className="space-y-3">
                {more.map((candidate) => (
                  <StoryRecommendation key={candidate.uuid} story={candidate} />
                ))}
              </div>
            </section>
          )}
          <div className="flex justify-center">
            <Button asChild variant="ghost">
              {isImport ? (
                <Link to="/reading/imports">Back to your imports</Link>
              ) : (
                <Link to="/reading">Back to Reading</Link>
              )}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function StoryCompletionHeader({
  story,
  wordCount,
}: Pick<StoryEndSectionProps, 'story' | 'wordCount'>) {
  const isDesktop = useIsDesktop();
  const isImport = story.groupKey === null;
  const metadata = [
    isImport ? 'Your import' : story.groupTitle,
    `${story.totalPages} ${story.totalPages === 1 ? 'page' : 'pages'}`,
    wordCount && wordCount > 0
      ? `${wordCount.toLocaleString('en')} words`
      : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <header className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {!isImport && story.cefrLevel && (
          <Badge tone={getCefrBadgeTone(story.cefrLevel)}>
            {story.cefrLevel}
          </Badge>
        )}
        <Text as="span" size="medium" tone="subtle">
          {metadata}
        </Text>
      </div>
      <Heading
        as="h1"
        id="story-finished-title"
        size={isDesktop ? 'xlarge' : 'large'}
      >
        Story finished
      </Heading>
      <Text size="medium" tone="subtle">
        You read{' '}
        <Text as="span" weight="semibold" tone="default" lang="nb">
          {story.title}
        </Text>
        {story.readingMinutes > 0
          ? ` in ${formatReadingMinutesPhrase(story.readingMinutes)}`
          : null}
        .
      </Text>
    </header>
  );
}

function StoryRecap({
  vocabulary,
  lookups,
  onLookup,
  onAddWords,
}: Pick<
  StoryEndSectionProps,
  'vocabulary' | 'lookups' | 'onLookup' | 'onAddWords'
>) {
  const hasVocabulary =
    vocabulary !== undefined &&
    vocabulary.mastered + vocabulary.learning + vocabulary.new > 0;
  return (
    <section
      className="radius-section min-w-0 space-y-4 border border-default bg-raised p-4 shadow-soft lg:col-span-3"
      aria-label="What this story gave you"
    >
      {hasVocabulary && vocabulary && (
        <StoryVocabularySummary vocabulary={vocabulary} />
      )}
      {lookups.length > 0 && (
        <div
          className={hasVocabulary ? 'border-t border-default pt-4' : undefined}
        >
          <StoryLookupSummary
            lookups={lookups}
            onLookup={onLookup}
            onAddWords={onAddWords}
            first={vocabulary?.mastered === 0}
          />
        </div>
      )}
    </section>
  );
}

function StoryVocabularySummary({
  vocabulary,
}: {
  vocabulary: StoryVocabulary;
}) {
  const total = vocabulary.mastered + vocabulary.learning + vocabulary.new;
  if (total === 0) return null;
  if (vocabulary.mastered === 0) {
    const count = vocabulary.new || vocabulary.learning;
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <Heading as="span" size="xxlarge" weight="bold">
            {count.toLocaleString('en')}
          </Heading>
          <Text as="span" size="medium">
            words in this story are{' '}
            {vocabulary.new > 0 ? 'new to you' : 'in review'}
          </Text>
        </div>
        <Text size="small" tone="subtle">
          Once you know some words, this shows how much of each story you can
          already read.
        </Text>
      </div>
    );
  }
  const percentage = Math.round((vocabulary.mastered * 100) / total);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Heading as="span" size="xxlarge" weight="bold">
          {percentage}%
        </Heading>
        <Text as="span" size="medium">
          of the {total.toLocaleString('en')} words in this story are mastered
        </Text>
      </div>
      <progress
        className="story-mastery-progress block h-2 w-full appearance-none overflow-hidden rounded-full bg-neutral-subtle"
        aria-label="Mastered words"
        value={vocabulary.mastered}
        max={total}
      />
      {vocabulary.mastered === total ? (
        <Text size="medium" tone="subtle">
          You know every word in this story.
        </Text>
      ) : (
        <Text as="div" size="medium" tone="subtle">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <span>{vocabulary.mastered.toLocaleString('en')} mastered</span>
            {vocabulary.learning > 0 && (
              <>
                <span aria-hidden>·</span>
                <span className="word-underline-learning text-default">
                  {vocabulary.learning.toLocaleString('en')} learning
                </span>
              </>
            )}
            {vocabulary.new > 0 && (
              <>
                <span aria-hidden>·</span>
                <span className="word-underline-new text-default">
                  {vocabulary.new.toLocaleString('en')} new
                </span>
              </>
            )}
          </div>
        </Text>
      )}
    </div>
  );
}

function StoryLookupSummary({
  lookups,
  onLookup,
  onAddWords,
  first,
}: Pick<StoryEndSectionProps, 'lookups' | 'onLookup' | 'onAddWords'> & {
  first: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const desktop = useIsDesktop();
  const { addition, eligible, add } = useStoryWordReview(lookups, onAddWords);
  const added = new Set(addition.added);
  const newCount = eligible.length;
  const limit = desktop ? 20 : lookups.length > 12 ? 8 : 12;
  const visible = expanded ? lookups : lookups.slice(0, limit);
  const suffix =
    newCount === 0 || lookups.length === 1
      ? ''
      : newCount === lookups.length
        ? ' · all new'
        : ` · ${newCount} new`;
  return (
    <div className="space-y-3">
      <Heading as="h2" size="xsmall">
        Words you looked up{' '}
        <Text as="span" size="medium" tone="subtle" weight="semibold">
          {lookups.length}
          {suffix}
        </Text>
      </Heading>
      <div
        className="flex flex-wrap gap-2"
        lang="nb"
        role="group"
        aria-label="Looked-up words"
      >
        {visible.map((word) => (
          <StoryLookupChip
            key={word.lemmaUuid ?? word.text}
            word={word}
            added={added.has(word.lemmaUuid ?? '')}
            onLookup={onLookup}
          />
        ))}
        {!expanded && lookups.length > limit && (
          <Button
            variant="outline"
            size="sm"
            shape="pill"
            aria-expanded={false}
            onClick={() => setExpanded(true)}
          >
            Show all {lookups.length}
          </Button>
        )}
      </div>
      <Text size="small" tone="subtle">
        Tap a word to see it again.
        {first ? ' Words you add come back in Practice.' : ''}
      </Text>
      <StoryReviewAction
        addition={addition}
        eligibleCount={eligible.length}
        onAdd={add}
      />
    </div>
  );
}

function StoryLookupChip({
  word,
  added,
  onLookup,
}: {
  word: StoryLookupWord;
  added: boolean;
  onLookup: StoryEndSectionProps['onLookup'];
}) {
  const state = word.state === 'new' && added ? 'learning' : word.state;
  return (
    <Button
      variant="outline"
      size="sm"
      shape="pill"
      aria-label={`Look up ${word.dictionaryForm}`}
      onClick={() => onLookup(word)}
    >
      <Text as="span" size="large">
        <span
          className={
            state === 'new'
              ? 'word-underline-new'
              : state === 'learning'
                ? 'word-underline-learning'
                : undefined
          }
        >
          {word.dictionaryForm}
        </span>
      </Text>
    </Button>
  );
}

function StoryReviewAction({
  addition,
  eligibleCount,
  onAdd,
}: {
  addition: ReviewAddition;
  eligibleCount: number;
  onAdd: () => Promise<void>;
}) {
  const pending = addition.kind === 'pending';
  const label = pending
    ? 'Adding words to review…'
    : addition.kind === 'settled' && addition.failed.length > 0
      ? `Retry ${eligibleCount} ${eligibleCount === 1 ? 'word' : 'words'}`
      : eligibleCount === 1
        ? 'Add this word to review'
        : `Add ${eligibleCount} new words to review`;
  return (
    <>
      <StoryReviewStatus addition={addition} />
      {(eligibleCount > 0 || pending) && (
        <Button
          variant="outline"
          width="full"
          disabled={pending}
          onClick={() => void onAdd()}
        >
          <Plus aria-hidden />
          {label}
        </Button>
      )}
    </>
  );
}

function StoryReviewStatus({ addition }: { addition: ReviewAddition }) {
  if (addition.kind === 'idle') return null;
  if (addition.kind === 'pending')
    return (
      <div role="status">
        <Text size="small" tone="subtle">
          Adding {addition.completed} of {addition.total} words to review…
        </Text>
      </div>
    );
  const messages = [];
  if (addition.added.length)
    messages.push(
      `Added ${addition.added.length} ${addition.added.length === 1 ? 'word' : 'words'} to review.`,
    );
  if (addition.failed.length)
    messages.push(
      `${addition.failed.length} ${addition.failed.length === 1 ? 'word could' : 'words could'} not be added. Try again.`,
    );
  return (
    <div role="status">
      <Text size="medium" tone={addition.failed.length ? 'danger' : 'success'}>
        {messages.join(' ')}
      </Text>
    </div>
  );
}

function NextStory({
  theme,
  story,
}: {
  theme: ReadingGroup;
  story: ReadingStorySummary;
}) {
  return (
    <section className="space-y-2" aria-labelledby="story-next-in-theme">
      <Text as="h2" id="story-next-in-theme" role="eyebrow" tone="subtle">
        Next in {theme.title}
      </Text>
      <div className="radius-section space-y-3 border border-default bg-raised p-4 shadow-soft">
        <div className="flex flex-wrap items-center gap-2">
          {story.cefrLevel && (
            <Badge tone={getCefrBadgeTone(story.cefrLevel)}>
              {story.cefrLevel}
            </Badge>
          )}
          {story.wordCount > 0 && (
            <Text as="span" size="small" tone="subtle">
              {story.wordCount.toLocaleString('en')} words
            </Text>
          )}
        </div>
        <Heading as="h3" size="medium" lang="nb">
          {story.title}
        </Heading>
        <Button asChild width="full">
          <Link to="/reading/story/$uuid" params={{ uuid: story.uuid }}>
            Read next story
            <ChevronRight aria-hidden />
          </Link>
        </Button>
      </div>
    </section>
  );
}

function ThemeEnd({
  continuation,
  otherThemes,
}: {
  continuation: Extract<StoryContinuation, { kind: 'last' }>;
  otherThemes: readonly ReadingGroup[];
}) {
  return (
    <section className="space-y-3" aria-label="Theme finished">
      <div className="radius-field bg-neutral-subtle p-3">
        <Text size="medium">
          That was the last story in {continuation.theme.title}.
          {continuation.allRead && continuation.theme.storyCount > 0
            ? ` You have read all ${continuation.theme.storyCount}.`
            : ''}
        </Text>
      </div>
      {otherThemes.length > 0 && (
        <>
          <Heading as="h2" size="small">
            Try another theme
          </Heading>
          {otherThemes.slice(0, 2).map((theme) => (
            <Row
              key={theme.key}
              asChild
              size="md"
              surface="framed"
              trailing={<ChevronRight className="icon-sm" aria-hidden />}
            >
              <Link
                to="/reading/themes/$key"
                params={{ key: theme.key }}
                search={{}}
              >
                <div className="min-w-0 space-y-1">
                  <Heading as="h3" size="xsmall">
                    {theme.title}
                  </Heading>
                  {theme.storyCount > 0 && (
                    <Text size="small" tone="subtle">
                      {theme.storyCount} stories
                    </Text>
                  )}
                </div>
              </Link>
            </Row>
          ))}
        </>
      )}
    </section>
  );
}

function StoryRecommendation({ story }: { story: ReadingStorySummary }) {
  return (
    <Row
      asChild
      size="md"
      surface="framed"
      trailing={<ChevronRight className="icon-sm" aria-hidden />}
    >
      <Link to="/reading/story/$uuid" params={{ uuid: story.uuid }}>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {story.cefrLevel && (
              <Badge tone={getCefrBadgeTone(story.cefrLevel)}>
                {story.cefrLevel}
              </Badge>
            )}
            {story.completed ? (
              <Badge tone="success">
                <Check className="icon-xs" aria-hidden />
                Finished
              </Badge>
            ) : (
              story.isRead && <Badge>In progress</Badge>
            )}
          </div>
          <Heading as="h3" size="small">
            <span className="line-clamp-2" title={story.title} lang="nb">
              {story.title}
            </span>
          </Heading>
          {story.wordCount > 0 && (
            <Text size="small" tone="subtle">
              {story.wordCount.toLocaleString('en')} words
            </Text>
          )}
        </div>
      </Link>
    </Row>
  );
}
