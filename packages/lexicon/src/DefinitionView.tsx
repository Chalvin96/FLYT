import { Badge, Button, Text } from '@flyt/ui';
import type { ClosedProps } from '@flyt/ui';
import { cn } from '@flyt/ui/lib/utils';
import type { ReactNode } from 'react';

import { DefinitionExamples } from './DefinitionExamples';
import { NorwegianDefinition } from './NorwegianDefinition';
import type { DefinitionRead, LemmaPos, WordFormRead } from './types';

export type DefinitionViewSpacing = 'default' | 'compact';

const DEFINITION_VIEW_SPACING: Record<DefinitionViewSpacing, string> = {
  default: 'gap-4 md:gap-5',
  compact: 'gap-2',
};

export interface DefinitionViewProps extends ClosedProps<'div'> {
  definition: DefinitionRead;
  wordForms?: WordFormRead[];
  pos?: LemmaPos;
  isAdded?: boolean;
  onAddToDeck?: () => void;
  isAdding?: boolean;
  presentation?: 'lexicon' | 'flashcard';
  spacing?: DefinitionViewSpacing;
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
  // `pos` and `inflectionLayout` stay in the props for callers; this view
  // never reads them, because the `inflection` slot supplies the table.
  definition,
  wordForms,
  isAdded = false,
  onAddToDeck,
  isAdding = false,
  presentation,
  spacing,
  inflection,
  collapsibleExamples = false,
  pos: _pos,
  inflectionLayout: _inflectionLayout,
  ...rootProps
}: DefinitionViewProps) {
  const resolvedPresentation =
    presentation ?? (onAddToDeck ? 'lexicon' : 'flashcard');
  const spacingClass = DEFINITION_VIEW_SPACING[spacing ?? 'default'];

  return (
    <div
      data-testid="definition-item-root"
      data-presentation={resolvedPresentation}
      {...rootProps}
      className={cn('flex min-w-0 flex-col', spacingClass)}
      style={undefined}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        {definition.translation ? (
          <div className="min-w-0 flex-1 break-words">
            <Text as="p" size="large" tone="default">
              {definition.translation}
            </Text>
          </div>
        ) : (
          <div className="min-w-0 flex-1 break-words italic">
            <Text as="p" size="medium" tone="subtle">
              Translation not available
            </Text>
          </div>
        )}

        {onAddToDeck && !isAdded && (
          <Button
            size="sm"
            variant="outline"
            onClick={onAddToDeck}
            disabled={isAdding}
          >
            {isAdding ? 'Adding...' : 'Add to Deck'}
          </Button>
        )}
        {isAdded && <Badge tone="brand">Added</Badge>}
      </div>

      <DefinitionExamples
        examples={definition.examples_json}
        collapsible={collapsibleExamples}
        presentation={resolvedPresentation}
      />
      <NorwegianDefinition text={definition.definition} />

      {wordForms && wordForms.length > 0 && (
        <div
          data-testid="inflection-section"
          className="pt-2 border-t border-default flex flex-col md:flex-row"
        >
          {inflection}
        </div>
      )}
    </div>
  );
}
