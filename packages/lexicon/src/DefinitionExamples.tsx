import { disclosureTriggerClassName, Glyph, Text } from '@flyt/ui';
import { useId, useState } from 'react';

import { DefinitionExample } from './DefinitionExample';
import type { ExamplePair } from './types';

const EXAMPLE_CONTAINER_PRESENTATION: Record<'lexicon' | 'flashcard', string> =
  {
    lexicon: '',
    flashcard: 'hidden md:block',
  };

export function DefinitionExamples({
  examples,
  collapsible,
  presentation,
}: {
  examples: ExamplePair[];
  collapsible: boolean;
  presentation: 'lexicon' | 'flashcard';
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
        className={`space-y-1 ${EXAMPLE_CONTAINER_PRESENTATION[presentation]}`}
        data-testid="definition-examples"
      >
        <Text as="p" size="medium" tone="subtle" weight="semibold">
          Examples:
        </Text>
        <div className="border-l-2 border-default space-y-1 pl-3">
          {content}
        </div>
      </div>
    );
  return (
    <div data-testid="definition-examples">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className={disclosureTriggerClassName}
      >
        <Glyph size="3xs">{expanded ? '▼' : '▶'}</Glyph>
        {`Examples · ${examples.length}`}
      </button>
      {expanded ? <div className="mt-1.5 space-y-1 pl-4">{content}</div> : null}
    </div>
  );
}
