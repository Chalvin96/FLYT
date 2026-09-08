import type { ReactNode } from 'react';

import { Badge } from '@flyt/ui';
import { Button } from '@flyt/ui';

import type { DefinitionRead, LemmaPos, WordFormRead } from './types';
import { DefinitionExamples } from './DefinitionExamples';
import { NorwegianDefinition } from './NorwegianDefinition';

export interface DefinitionViewProps {
  definition: DefinitionRead;
  wordForms?: WordFormRead[];
  pos?: LemmaPos;
  isAdded?: boolean;
  onAddToDeck?: () => void;
  isAdding?: boolean;
  className?: string;
  variant?: 'lexicon' | 'flashcard';
  inflectionLayout?: 'auto' | 'horizontal' | 'vertical';
  /** Optional inflection slot. The app passes its InflectionTable; the extension omits it. */
  inflection?: ReactNode;
  /** Collapse examples behind a toggle instead of showing inline. */
  collapsibleExamples?: boolean;
}

export function DefinitionView({ definition, ...props }: DefinitionViewProps) {
  return (
    <DefinitionContent
      key={`${definition.uuid}:${definition.definition}`}
      definition={definition}
      {...props}
    />
  );
}

function DefinitionContent({
  // `pos` and `inflectionLayout` remain in DefinitionViewProps for caller
  // compat (the frontend DefinitionItem shim forwards them), but the pure
  // view no longer renders the inflection table itself — the app injects it
  // via the `inflection` slot — so they are intentionally not destructured.
  definition,
  wordForms,
  isAdded = false,
  onAddToDeck,
  isAdding = false,
  className = '',
  variant,
  inflection,
  collapsibleExamples = false,
}: DefinitionViewProps) {
  const resolvedVariant = variant ?? (onAddToDeck ? 'lexicon' : 'flashcard');

  return (
    <div
      data-testid="definition-item-root"
      data-variant={resolvedVariant}
      className={`flex min-w-0 flex-col gap-4 md:gap-5 ${className}`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        {definition.translation ? (
          <p className="type-body min-w-0 flex-1 break-words font-medium text-foreground">
            {definition.translation}
          </p>
        ) : (
          <p className="type-caption min-w-0 flex-1 break-words text-muted-foreground italic">
            Translation not available
          </p>
        )}

        {onAddToDeck && !isAdded && (
          <Button
            size="sm"
            variant="outline"
            onClick={onAddToDeck}
            disabled={isAdding}
            className="flex-shrink-0"
          >
            {isAdding ? 'Adding...' : 'Add to Deck'}
          </Button>
        )}
        {isAdded && (
          <Badge
            variant="secondary"
            className="px-2 py-0.5 type-caption-sm bg-primary/15 text-primary border-primary/30"
          >
            Added
          </Badge>
        )}
      </div>

      <DefinitionExamples
        examples={definition.examples_json}
        collapsible={collapsibleExamples}
        variant={resolvedVariant}
      />
      <NorwegianDefinition text={definition.definition} />

      {wordForms && wordForms.length > 0 && (
        <div
          data-testid="inflection-section"
          className="pt-2 border-t border-border flex flex-col md:flex-row"
        >
          {inflection}
        </div>
      )}
    </div>
  );
}
