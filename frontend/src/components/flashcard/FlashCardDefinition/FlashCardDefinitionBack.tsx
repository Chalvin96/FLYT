import { LemmaHeader } from '@flyt/lexicon';
import {
  formatGenderSimple,
  getInflectionClassLabel,
} from '@flyt/lexicon/grammar';
import { memo, useState } from 'react';

import { GrammarTagBadge } from '@/components/common/GrammarTagBadge/GrammarTagBadge';
import { InflectionTable } from '@/components/flashcard/InflectionTable/InflectionTable';
import { hasStructuredInflection } from '@/components/flashcard/InflectionTable/utils';
import { splitTranslation } from '@/lib/translation';
import { cn } from '@/lib/utils';
import type {
  DefinitionRead,
  LemmaContextRead,
  LemmaPos,
  WordFormRead,
} from '@/types/api';

const MEANING_LIMIT = 3;

interface FlashCardDefinitionBackProps {
  word?: string;
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
}

function renderMeaning(definition: DefinitionRead) {
  const noGloss = definition.definition?.trim();
  const showGloss = noGloss && noGloss !== definition.translation?.trim();
  return (
    <li
      key={definition.uuid}
      className="flex flex-col gap-0.5 type-caption leading-snug text-secondary-80"
    >
      <span className="flex gap-2">
        <span className="text-secondary-40">·</span>
        {definition.translation}
      </span>
      {showGloss ? (
        <span className="pl-4 italic text-muted-foreground">{noGloss}</span>
      ) : null}
    </li>
  );
}

const FlashCardDefinitionBackComponent = ({
  word,
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
}: FlashCardDefinitionBackProps) => {
  const translation = splitTranslation(primaryTranslation);

  // Top-3 meanings as English translations, each with its Norwegian gloss
  // beneath when available (and not identical to the English). No numbers, no
  // examples on the answer face. Skip any definition without a translation —
  // an empty gloss adds nothing on the English answer face (and would render
  // an orphaned bullet).
  const meanings = definitions.filter((definition) => definition.translation);
  const topMeanings = meanings.slice(0, MEANING_LIMIT);
  const restMeanings = meanings.slice(MEANING_LIMIT);
  const [showRest, setShowRest] = useState(false);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden px-4 pb-4 pt-4 text-left sm:px-5 sm:pb-5 sm:pt-5">
      <div className="border-b border-border pb-4 text-center">
        <LemmaHeader
          word={word ?? ''}
          pos={pos ?? 'unknown'}
          ipa={ipa}
          ipaApproximate={ipaApproximate}
          intonation={intonation}
          audioUrl={audioUrl}
          headingAs="h2"
          headingClassName="type-display-lg break-words font-display leading-none text-secondary-90"
        />
        {(gender || (inflectionClass && isVerb)) && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {gender && <GrammarTagBadge label={formatGenderSimple(gender)} />}
            {inflectionClass && isVerb && (
              <GrammarTagBadge
                label={getInflectionClassLabel(inflectionClass)}
              />
            )}
          </div>
        )}
      </div>

      <div className="scrollbar-stable min-h-0 flex-1 overflow-y-auto pt-5 pr-1">
        {context ? (
          <aside className="mb-4 rounded-lg border border-border bg-secondary-0/45 px-3 py-2 text-left">
            <p className="type-caption font-semibold text-secondary-70">
              From this sentence
            </p>
            <p
              className="mt-1 type-caption leading-relaxed text-secondary-90"
              lang="no"
            >
              {context.source_sentence}
            </p>
            {context.source_title ? (
              <p className="mt-1 type-caption text-muted-foreground">
                {context.source_title}
              </p>
            ) : null}
          </aside>
        ) : null}

        {/* Bold primary translation */}
        {translation && (
          <div className="mb-4 border-b border-border pb-4 text-center">
            <p className="type-title font-bold text-foreground">
              {translation.primary}
            </p>
            {translation.alternates.length > 0 ? (
              <p className="mt-1 type-caption text-secondary-70">
                {translation.alternates.join(' · ')}
              </p>
            ) : null}
          </div>
        )}

        {/* Top meanings: English translation + Norwegian gloss */}
        {topMeanings.length > 0 && (
          <ul role="list" className="space-y-1.5">
            {topMeanings.map((definition) => renderMeaning(definition))}
          </ul>
        )}

        {/* Show N more meanings pill */}
        {restMeanings.length > 0 && !showRest && (
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={() => setShowRest(true)}
              className={cn(
                'rounded-full border border-primary/40 bg-primary/5 px-4 py-1.5 type-caption font-semibold text-primary transition-colors hover:bg-primary/10',
              )}
            >
              Show {restMeanings.length} more{' '}
              {restMeanings.length === 1 ? 'meaning' : 'meanings'}
            </button>
          </div>
        )}
        {showRest && restMeanings.length > 0 && (
          <ul role="list" className="mt-3 space-y-1.5">
            {restMeanings.map((definition) => renderMeaning(definition))}
          </ul>
        )}

        {/* BØYNING inflection grid with short Norwegian labels */}
        {hasStructuredInflection(wordForms, pos) ? (
          <div className="mt-5 pt-4">
            <InflectionTable wordForms={wordForms} pos={pos} layout="auto" />
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const FlashCardDefinitionBack = memo(FlashCardDefinitionBackComponent);
