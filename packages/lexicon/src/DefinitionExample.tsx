import { Glyph, Text } from '@flyt/ui';

import type { ExamplePair } from './types';

export function DefinitionExample({
  example,
  open,
  id,
  onToggle,
}: {
  example: ExamplePair;
  open: boolean;
  id: string;
  onToggle: () => void;
}) {
  const hasEnglish = Boolean(example.en);
  return (
    <div className="space-y-0.5">
      {hasEnglish ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={id}
          className="italic text-subtle text-left cursor-pointer transition-colors hover:text-default inline bg-transparent border-0 p-0"
        >
          <Text as="span" size="medium">
            {example.no}
          </Text>
          <span className="ml-1 align-baseline">
            <Glyph size="3xs">{open ? '▼' : '▶'}</Glyph>
          </span>
        </button>
      ) : (
        <p className="italic">
          <Text as="span" size="medium" tone="subtle">
            {example.no}
          </Text>
        </p>
      )}
      {hasEnglish ? (
        <Text as="p" hidden={!open} id={id} size="medium" tone="subtle">
          {example.en}
        </Text>
      ) : null}
    </div>
  );
}
