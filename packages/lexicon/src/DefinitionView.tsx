import { useEffect, useId, useState } from 'react';
import type { ReactNode } from 'react';

import { Badge } from '@flyt/ui';
import { Button } from '@flyt/ui';

import type {
  DefinitionRead,
  ExamplePair,
  LemmaPos,
  WordFormRead,
} from './types';

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

export function DefinitionView({
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
  const [isNorDefinitionExpanded, setIsNorDefinitionExpanded] = useState(false);
  const [isExamplesExpanded, setIsExamplesExpanded] = useState(false);
  const [openExampleIdx, setOpenExampleIdx] = useState<number | null>(null);
  const instanceId = useId();
  const resolvedVariant = variant ?? (onAddToDeck ? 'lexicon' : 'flashcard');

  // Reset reveal state when the definition changes (parent swaps without remount).
  // Key on uuid for the lexicon path and on the gloss text as a fallback: the
  // flashcard path synthesizes uuid: '' (DefinitionEntry has no uuid), so uuid
  // alone wouldn't detect a swap there.
  useEffect(() => {
    setOpenExampleIdx(null);
  }, [definition.uuid, definition.definition]);

  // Whole-sentence tap target (D4/D5). Collapsed height == schema v2: the only
  // added glyph is an inline chevron. `en: null`/"­" → plain <p>, no affordance.
  // Collapsed English is `hidden` so it leaves the a11y tree (not just visual).
  const renderExample = (ex: ExamplePair, index: number) => {
    const open = openExampleIdx === index;
    const enId = `${instanceId}-example-en-${index}`;
    const hasEn = ex.en != null && ex.en !== '';
    return (
      <div key={index} className="space-y-0.5">
        {hasEn ? (
          <button
            type="button"
            onClick={() => setOpenExampleIdx(open ? null : index)}
            aria-expanded={open}
            aria-controls={enId}
            className="type-caption italic text-secondary-80 text-left cursor-pointer transition-colors hover:text-secondary-100 inline bg-transparent border-0 p-0"
          >
            {ex.no}
            <span
              aria-hidden="true"
              className="ml-1 align-baseline text-[10px] leading-none"
            >
              {open ? '▼' : '▶'}
            </span>
          </button>
        ) : (
          <p className="type-caption italic text-secondary-80">{ex.no}</p>
        )}
        {hasEn && (
          <p
            id={enId}
            hidden={!open}
            className="type-caption text-muted-foreground"
          >
            {ex.en}
          </p>
        )}
      </div>
    );
  };

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

      {definition.examples_json.length > 0 &&
        (collapsibleExamples ? (
          <div data-testid="definition-examples">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsExamplesExpanded(!isExamplesExpanded)}
              aria-expanded={isExamplesExpanded}
              className="!px-0 !py-0 h-auto text-left type-caption font-medium text-secondary-70 transition-colors hover:text-secondary-90 flex items-center gap-1.5 justify-start"
            >
              <span aria-hidden="true" className="text-[10px] leading-none">
                {isExamplesExpanded ? '▼' : '▶'}
              </span>
              {`Examples · ${definition.examples_json.length}`}
            </Button>
            {isExamplesExpanded && (
              <div className="mt-1.5 space-y-1 pl-4">
                {definition.examples_json.map(renderExample)}
              </div>
            )}
          </div>
        ) : (
          <div
            className={`space-y-1 ${
              resolvedVariant === 'flashcard' ? 'hidden md:block' : ''
            }`}
            data-testid="definition-examples"
          >
            <p className="type-caption text-muted-foreground font-medium">
              Examples:
            </p>
            <div className="border-l-2 border-border space-y-1 pl-3">
              {definition.examples_json.map(renderExample)}
            </div>
          </div>
        ))}

      {definition.definition && (
        <div className="space-y-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsNorDefinitionExpanded(!isNorDefinitionExpanded)}
            aria-expanded={isNorDefinitionExpanded}
            className="!px-0 !py-0 h-auto w-full whitespace-normal text-left type-caption font-medium text-secondary-70 transition-colors hover:text-secondary-90 flex items-center gap-1.5 justify-start"
          >
            <span aria-hidden="true" className="text-[10px] leading-none">
              {isNorDefinitionExpanded ? '▼' : '▶'}
            </span>
            <span className="flex-1">
              {isNorDefinitionExpanded
                ? 'Hide Norwegian definition'
                : 'Show Norwegian definition'}
            </span>
          </Button>
          {isNorDefinitionExpanded && (
            <p className="type-caption break-words pl-4 italic text-secondary-70">
              {definition.definition}
            </p>
          )}
        </div>
      )}

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
