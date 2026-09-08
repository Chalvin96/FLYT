import { useId, useState } from 'react';
import { Button } from '@flyt/ui';
import { DefinitionExample } from './DefinitionExample';
import type { ExamplePair } from './types';

export function DefinitionExamples({
  examples,
  collapsible,
  variant,
}: {
  examples: ExamplePair[];
  collapsible: boolean;
  variant: 'lexicon' | 'flashcard';
}) {
  const [expanded, setExpanded] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const instanceId = useId();
  if (examples.length === 0) return null;
  const keyOccurrences = new Map<string, number>();
  const content = examples.map((example, index) => {
    const contentKey = `${example.no}:${example.en ?? ''}`;
    const occurrence = keyOccurrences.get(contentKey) ?? 0;
    keyOccurrences.set(contentKey, occurrence + 1);
    const exampleKey = `${contentKey}:${occurrence}`;
    return (
      <DefinitionExample
        key={exampleKey}
        example={example}
        open={openIndex === index}
        id={`${instanceId}-example-en-${index}`}
        onToggle={() => setOpenIndex(openIndex === index ? null : index)}
      />
    );
  });
  if (!collapsible)
    return (
      <div
        className={`space-y-1 ${variant === 'flashcard' ? 'hidden md:block' : ''}`}
        data-testid="definition-examples"
      >
        <p className="type-caption text-muted-foreground font-medium">
          Examples:
        </p>
        <div className="border-l-2 border-border space-y-1 pl-3">{content}</div>
      </div>
    );
  return (
    <div data-testid="definition-examples">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="!px-0 !py-0 h-auto text-left type-caption font-medium text-secondary-70 transition-colors hover:text-secondary-90 flex items-center gap-1.5 justify-start"
      >
        <span aria-hidden="true" className="text-[10px] leading-none">
          {expanded ? '▼' : '▶'}
        </span>
        {`Examples · ${examples.length}`}
      </Button>
      {expanded ? <div className="mt-1.5 space-y-1 pl-4">{content}</div> : null}
    </div>
  );
}
