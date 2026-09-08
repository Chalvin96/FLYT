import { useState } from 'react';
import { Button } from '@flyt/ui';

import { DefinitionView } from './DefinitionView';
import { LemmaActionRow, type LemmaActionRowProps } from './LemmaActionRow';
import { LemmaHeader } from './LemmaHeader';
import type {
  LemmaActionState,
  LemmaCardData,
  LemmaRelatedRead,
} from './types';

const SENSE_LIMIT = 3;

export interface LemmaCardViewProps extends Pick<
  LemmaActionRowProps,
  'isSubmitting' | 'pendingAction' | 'behavior' | 'knowLabel' | 'addLabel'
> {
  lemma: LemmaCardData;
  state: LemmaActionState;
  onMarkKnown: LemmaActionRowProps['onMarkKnown'];
  onAddToReview: LemmaActionRowProps['onAddToReview'];
  onSelectRelated?: (uuid: string, word: string) => void;
  headingClassName?: string;
  className?: string;
}

function splitTranslation(value?: string | null) {
  const parts =
    value
      ?.split(' / ')
      .map((part) => part.trim())
      .filter(Boolean) ?? [];
  return parts.length > 0
    ? { primary: parts[0]!, alternates: parts.slice(1, 4) }
    : null;
}

export function LemmaCardView({
  lemma,
  state,
  onMarkKnown,
  onAddToReview,
  onSelectRelated,
  headingClassName,
  className,
  ...actionProps
}: LemmaCardViewProps) {
  const [showAllSenses, setShowAllSenses] = useState(false);
  const translation = splitTranslation(lemma.primary_translation);
  const visibleDefinitions = showAllSenses
    ? lemma.definitions
    : lemma.definitions.slice(0, SENSE_LIMIT);
  const hiddenCount = lemma.definitions.length - visibleDefinitions.length;

  return (
    <article
      data-testid="lemma-card-view"
      className={
        className ?? 'radius-section space-y-4 border border-border bg-card p-4'
      }
    >
      <div className="space-y-2.5">
        <LemmaHeader
          word={lemma.word}
          pos={lemma.pos}
          ipa={lemma.ipa ?? null}
          ipaApproximate={lemma.ipa_approximate ?? false}
          intonation={lemma.intonation ?? null}
          audioUrl={lemma.audio_url ?? null}
          headingAs="h3"
          headingClassName={headingClassName}
        />
        {translation && (
          <div className="space-y-0.5">
            <p className="type-section font-bold text-foreground">
              {translation.primary}
            </p>
            {translation.alternates.length > 0 && (
              <p className="type-caption text-secondary-70">
                {translation.alternates.join(
                  ' ' + String.fromCharCode(183) + ' ',
                )}
              </p>
            )}
          </div>
        )}
      </div>

      {visibleDefinitions.length > 0 && (
        <>
          <div className="h-px bg-border/70" />
          <div className="space-y-4">
            {visibleDefinitions.map((definition, index) => (
              <div key={definition.uuid} className="flex min-w-0 gap-3">
                <span className="select-none pt-0.5 type-caption tabular-nums text-secondary-40">
                  {index + 1}.
                </span>
                <DefinitionView
                  definition={definition}
                  variant="lexicon"
                  collapsibleExamples
                  className="min-w-0 flex-1 gap-2"
                />
              </div>
            ))}
            {hiddenCount > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAllSenses(true)}
                aria-label={
                  'Show ' +
                  hiddenCount +
                  ' more ' +
                  (hiddenCount === 1 ? 'meaning' : 'meanings')
                }
                className="ml-7"
              >
                Show {hiddenCount} more{' '}
                {hiddenCount === 1 ? 'meaning' : 'meanings'}
              </Button>
            )}
          </div>
        </>
      )}

      {lemma.see_also && lemma.see_also.length > 0 && (
        <RelatedRow entries={lemma.see_also} onSelect={onSelectRelated} />
      )}

      <div className="border-t border-border pt-2">
        <LemmaActionRow
          {...actionProps}
          state={state}
          onMarkKnown={onMarkKnown}
          onAddToReview={onAddToReview}
        />
      </div>
    </article>
  );
}

function RelatedRow({
  entries,
  onSelect,
}: {
  entries: LemmaRelatedRead[];
  onSelect?: (uuid: string, word: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
      <span className="type-caption font-semibold text-secondary-70">
        Related:
      </span>
      {entries.map((entry, index) => {
        const label = entry.relation === 'compare' ? 'Compare' : 'See';
        const text = label + ' ' + entry.word;
        const targetUuid = entry.target_lemma_uuid;
        if (targetUuid && onSelect) {
          return (
            <button
              key={entry.article_id + '-' + index}
              type="button"
              onClick={() => onSelect(targetUuid, entry.word)}
              className="type-caption font-medium text-primary underline-offset-2 hover:underline"
            >
              {text}
            </button>
          );
        }
        return (
          <span
            key={entry.article_id + '-' + index}
            className="type-caption text-secondary-40"
          >
            {text}
          </span>
        );
      })}
    </div>
  );
}
