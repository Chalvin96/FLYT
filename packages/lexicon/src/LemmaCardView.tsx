import { Button, Chip, Heading, Text } from '@flyt/ui';
import type { ClosedProps } from '@flyt/ui';
import { cn } from '@flyt/ui/lib/utils';
import { useState } from 'react';

import { DefinitionView } from './DefinitionView';
import { LemmaActionRow, type LemmaActionRowProps } from './LemmaActionRow';
import { LemmaHeader, type LemmaHeadingTypography } from './LemmaHeader';
import type {
  LemmaActionState,
  LemmaCardData,
  LemmaRelatedRead,
} from './types';

const SENSE_LIMIT = 3;

export type LemmaCardSurface = 'card' | 'plain';

const LEMMA_CARD_SURFACE: Record<LemmaCardSurface, string> = {
  card: 'radius-section border border-default bg-raised p-4',
  plain: '',
};

export interface LemmaCardViewProps
  extends
    Pick<
      LemmaActionRowProps,
      'isSubmitting' | 'pendingAction' | 'behavior' | 'knowLabel' | 'addLabel'
    >,
    ClosedProps<'article'> {
  lemma: LemmaCardData;
  state: LemmaActionState;
  onMarkKnown: LemmaActionRowProps['onMarkKnown'];
  onAddToReview: LemmaActionRowProps['onAddToReview'];
  onSelectRelated?: (uuid: string, word: string) => void;
  headingTypography?: LemmaHeadingTypography;
  surface?: LemmaCardSurface;
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
  headingTypography,
  surface,
  isSubmitting,
  pendingAction,
  behavior,
  knowLabel,
  addLabel,
  ...rootProps
}: LemmaCardViewProps) {
  const [showAllSenses, setShowAllSenses] = useState(false);
  const translation = splitTranslation(lemma.primary_translation);
  const surfaceClass = LEMMA_CARD_SURFACE[surface ?? 'card'];
  const visibleDefinitions = showAllSenses
    ? lemma.definitions
    : lemma.definitions.slice(0, SENSE_LIMIT);
  const hiddenCount = lemma.definitions.length - visibleDefinitions.length;

  return (
    <article
      data-testid="lemma-card-view"
      data-state={state}
      {...rootProps}
      className={cn('space-y-4', surfaceClass)}
      style={undefined}
    >
      <div className="space-y-2.5">
        <LemmaHeader
          word={lemma.word}
          pos={lemma.pos}
          primaryDisplayForm={lemma.primary_display_form}
          alternativeForms={lemma.alternative_forms}
          ipa={lemma.ipa ?? null}
          ipaApproximate={lemma.ipa_approximate ?? false}
          intonation={lemma.intonation ?? null}
          audioUrl={lemma.audio_url ?? null}
          headingAs="h3"
          headingTypography={headingTypography}
        />
        {translation && (
          <div className="space-y-0.5">
            <Heading as="div" size="medium">
              {translation.primary}
            </Heading>
            {translation.alternates.length > 0 && (
              <Text as="p" size="medium" tone="subtle">
                {translation.alternates.join(
                  ' ' + String.fromCharCode(183) + ' ',
                )}
              </Text>
            )}
          </div>
        )}
      </div>

      {visibleDefinitions.length > 0 && (
        <>
          <div className="h-px bg-neutral-pressed/70" />
          <div className="space-y-4">
            {visibleDefinitions.map((definition, index) => (
              <div key={definition.uuid} className="flex min-w-0 gap-3">
                <span className="select-none pt-0.5 tabular-nums">
                  <Text as="span" size="medium" tone="subtle">
                    {index + 1}.
                  </Text>
                </span>
                <div className="min-w-0 flex-1">
                  <DefinitionView
                    definition={definition}
                    presentation="lexicon"
                    spacing="compact"
                    collapsibleExamples
                  />
                </div>
              </div>
            ))}
            {hiddenCount > 0 && (
              <span className="ml-7 inline-flex">
                <Chip
                  variant="filter"
                  onClick={() => setShowAllSenses(true)}
                  aria-label={
                    'Show ' +
                    hiddenCount +
                    ' more ' +
                    (hiddenCount === 1 ? 'meaning' : 'meanings')
                  }
                >
                  Show {hiddenCount} more{' '}
                  {hiddenCount === 1 ? 'meaning' : 'meanings'}
                </Chip>
              </span>
            )}
          </div>
        </>
      )}

      {lemma.see_also && lemma.see_also.length > 0 && (
        <RelatedRow entries={lemma.see_also} onSelect={onSelectRelated} />
      )}

      <div className="border-t border-default pt-2">
        <LemmaActionRow
          state={state}
          isSubmitting={isSubmitting}
          pendingAction={pendingAction}
          behavior={behavior}
          knowLabel={knowLabel}
          addLabel={addLabel}
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
      <Text as="span" size="medium" tone="subtle" weight="semibold">
        Related:
      </Text>
      {entries.map((entry, index) => {
        const label = entry.relation === 'compare' ? 'Compare' : 'See';
        const text = label + ' ' + entry.word;
        const targetUuid = entry.target_lemma_uuid;
        if (targetUuid && onSelect) {
          return (
            <Button
              key={entry.article_id + '-' + index}
              onClick={() => onSelect(targetUuid, entry.word)}
              type="button"
              variant="link"
            >
              {text}
            </Button>
          );
        }
        return (
          <Text
            as="span"
            key={entry.article_id + '-' + index}
            size="medium"
            tone="subtle"
          >
            {text}
          </Text>
        );
      })}
    </div>
  );
}
