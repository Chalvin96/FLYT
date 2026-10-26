import { LemmaHeader } from '@flyt/lexicon';
import {
  formatGenderSimple,
  getInflectionClassLabel,
} from '@flyt/lexicon/grammar';
import { Button, Heading, Text } from '@flyt/ui';
import { ChevronRight } from 'lucide-react';
import { memo, useState, type ReactNode, type Ref } from 'react';

import { InflectionTable } from '@/components/flashcard/InflectionTable/InflectionTable';
import { hasStructuredInflection } from '@/components/flashcard/InflectionTable/utils';
import { splitTranslation } from '@/lib/translation';
import { cn } from '@/lib/utils';
import type {
  DefinitionRead,
  ExamplePair,
  LemmaContextRead,
  LemmaPos,
  WordFormRead,
} from '@/types/api';

interface FlashCardDefinitionBackProps {
  word?: string;
  primaryDisplayForm?: string | null;
  alternativeForms?: string[];
  primaryTranslation?: string;
  definitions: DefinitionRead[];
  gender: string | null;
  inflectionClass?: string | null;
  isVerb: boolean;
  wordForms: WordFormRead[];
  pos?: LemmaPos;
  ipa?: string | null;
  ipaApproximate?: boolean;
  intonation?: string | null;
  audioUrl?: string | null;
  context?: LemmaContextRead | null;
  headingRef?: Ref<HTMLHeadingElement>;
}

function AnswerSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section>
      <Heading as="h3" size="xxsmall" tone="subtle">
        {label}
      </Heading>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function MeaningExample({ example }: { example?: ExamplePair | null }) {
  if (!example?.no) return null;

  return (
    <span className="mt-1.5 block border-l-2 border-default pl-2 text-subtle">
      <span lang="no">{example.no}</span>
      {example.en ? (
        <span className="mt-0.5 block text-subtle">{example.en}</span>
      ) : null}
    </span>
  );
}

function renderMeaning(definition: DefinitionRead) {
  const gloss = definition.definition?.trim();
  const showGloss = gloss && gloss !== definition.translation?.trim();
  return (
    <Text as="li" key={definition.uuid} size="medium" tone="default">
      {definition.translation}
      {showGloss ? (
        <span className="mt-0.5 block italic text-subtle" lang="no">
          {gloss}
        </span>
      ) : null}
      <MeaningExample example={definition.examples_json?.[0]} />
    </Text>
  );
}

function DefinitionHeader({
  audioUrl,
  gender,
  inflectionClass,
  intonation,
  ipa,
  ipaApproximate,
  isVerb,
  pos,
  primaryDisplayForm,
  word,
  headingRef,
}: {
  audioUrl?: string | null;
  gender: string | null;
  inflectionClass?: string | null;
  intonation?: string | null;
  ipa?: string | null;
  ipaApproximate?: boolean;
  isVerb: boolean;
  pos?: LemmaPos;
  primaryDisplayForm?: string | null;
  word?: string;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const grammarMetadata = gender
    ? formatGenderSimple(gender)
    : isVerb && inflectionClass
      ? getInflectionClassLabel(inflectionClass)
      : null;
  return (
    <LemmaHeader
      audioUrl={audioUrl}
      headingAs="h2"
      intonation={intonation}
      ipa={ipa}
      ipaApproximate={ipaApproximate}
      pos={pos ?? 'unknown'}
      primaryDisplayForm={primaryDisplayForm}
      word={word ?? ''}
      presentation="flashcard"
      grammarMetadata={grammarMetadata}
      headingRef={headingRef}
    />
  );
}

function DefinitionContextDisclosure({
  context,
}: {
  context: LemmaContextRead;
}) {
  return (
    <details className="group" data-testid="saved-context-disclosure">
      <summary className="radius-sm flex w-fit cursor-pointer list-none items-center gap-1.5 py-0.5 transition-colors hover:[&>span]:text-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focused)] focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        <Heading as="span" size="xxsmall" tone="subtle">
          Saved context
        </Heading>
        <ChevronRight
          aria-hidden="true"
          className="icon-xs shrink-0 transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none"
        />
      </summary>
      <figure className="mt-2 border-l-2 border-brand-subtle pl-3">
        <Text as="blockquote" lang="no" size="medium" tone="default">
          {context.source_sentence}
        </Text>
        {context.source_title ? (
          <div className="mt-1">
            <Text as="figcaption" size="small" tone="subtle">
              {context.source_title}
            </Text>
          </div>
        ) : null}
      </figure>
    </details>
  );
}

function AnswerBlock({
  translation,
  gloss,
  example,
}: {
  translation: NonNullable<ReturnType<typeof splitTranslation>>;
  gloss: string | null;
  example?: ExamplePair | null;
}) {
  return (
    <div>
      <Heading as="div" size="large">
        {translation.primary}
      </Heading>
      {translation.alternates.length > 0 ? (
        <div className="mt-1.5">
          <Text as="p" size="medium" tone="subtle">
            {translation.alternates.join(' · ')}
          </Text>
        </div>
      ) : null}
      {gloss ? (
        <div className="mt-3 italic">
          <Text as="p" lang="no" size="medium" tone="subtle">
            {gloss}
          </Text>
        </div>
      ) : null}
      <MeaningExample example={example} />
    </div>
  );
}

function DefinitionMeanings({
  meanings,
  start,
}: {
  meanings: DefinitionRead[];
  start: number;
}) {
  const topMeanings = meanings.slice(0, 3);
  const restMeanings = meanings.slice(3);
  const [showRest, setShowRest] = useState(false);
  const visible = showRest ? meanings : topMeanings;

  return (
    <>
      <ol
        className="list-decimal space-y-2 pl-5 marker:text-subtle @xl:columns-2 @xl:gap-x-8 @xl:space-y-0 @xl:[&>li]:mb-4 @xl:[&>li]:break-inside-avoid"
        role="list"
        start={start}
      >
        {visible.map((definition) => renderMeaning(definition))}
      </ol>
      {restMeanings.length > 0 && !showRest ? (
        <div className="mt-3">
          <Button
            align="start"
            onClick={() => setShowRest(true)}
            type="button"
            variant="link"
          >
            Show {restMeanings.length} more{' '}
            {restMeanings.length === 1 ? 'meaning' : 'meanings'}
          </Button>
        </div>
      ) : null}
    </>
  );
}

const FlashCardDefinitionBackComponent = ({
  word,
  primaryDisplayForm,
  alternativeForms = [],
  primaryTranslation,
  definitions,
  gender,
  inflectionClass,
  isVerb,
  wordForms,
  pos,
  ipa,
  ipaApproximate,
  intonation,
  audioUrl,
  context,
  headingRef,
}: FlashCardDefinitionBackProps) => {
  const translation = splitTranslation(primaryTranslation);
  const meanings = definitions.filter((definition) => definition.translation);

  const absorbsFirstSense =
    meanings[0]?.translation?.trim() === primaryTranslation?.trim();
  const answerGloss = absorbsFirstSense
    ? (meanings[0].definition?.trim() ?? null)
    : null;
  const remainingMeanings = absorbsFirstSense ? meanings.slice(1) : meanings;

  const referenceItems = [
    alternativeForms.length > 0 ? (
      <AnswerSection key="other-forms" label="Other forms">
        <Text size="medium" tone="default">
          {alternativeForms.join(' · ')}
        </Text>
      </AnswerSection>
    ) : null,
    hasStructuredInflection(wordForms, pos) ? (
      <AnswerSection key="inflection" label="Bøying">
        <InflectionTable layout="vertical" pos={pos} wordForms={wordForms} />
      </AnswerSection>
    ) : null,
  ].filter(Boolean);

  const savedContext = context?.source_sentence?.trim() ? (
    <DefinitionContextDisclosure context={context} key="context" />
  ) : null;
  const hasRail = referenceItems.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden px-4 text-left sm:px-5 @2xl:px-8">
      <DefinitionHeader
        audioUrl={audioUrl}
        gender={gender}
        inflectionClass={inflectionClass}
        intonation={intonation}
        ipa={ipa}
        ipaApproximate={ipaApproximate}
        isVerb={isVerb}
        pos={pos}
        primaryDisplayForm={primaryDisplayForm}
        word={word}
        headingRef={headingRef}
      />

      <div
        className="flex min-h-0 flex-1 flex-col overflow-y-auto pr-1"
        data-testid="flashcard-answer-body"
      >
        <div
          className={cn(
            'flex w-full flex-col gap-6 py-5 @2xl:py-7',
            hasRail &&
              '@2xl:grid @2xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] @2xl:items-start @2xl:gap-x-8 @2xl:gap-y-0',
          )}
        >
          <div className="@container flex min-w-0 flex-col gap-6 @2xl:gap-7">
            {translation ? (
              <AnswerBlock
                translation={translation}
                gloss={answerGloss}
                example={
                  absorbsFirstSense ? meanings[0].examples_json?.[0] : null
                }
              />
            ) : null}

            {remainingMeanings.length > 0 ? (
              <AnswerSection
                label={absorbsFirstSense ? 'Other meanings' : 'Meanings'}
              >
                <DefinitionMeanings
                  meanings={remainingMeanings}
                  start={absorbsFirstSense ? 2 : 1}
                />
              </AnswerSection>
            ) : null}

            {hasRail ? null : savedContext}
          </div>

          {hasRail ? (
            <aside
              aria-label="Reference"
              className="flex min-w-0 flex-col gap-6 @2xl:border-l @2xl:border-default @2xl:pl-8"
              data-testid="flashcard-answer-reference"
            >
              {referenceItems}
              {savedContext}
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export const FlashCardDefinitionBack = memo(FlashCardDefinitionBackComponent);
