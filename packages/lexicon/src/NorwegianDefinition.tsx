import { disclosureTriggerClassName, Glyph, Text } from '@flyt/ui';
import { useState } from 'react';

export function NorwegianDefinition({
  text,
}: {
  text: string | null | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className={`${disclosureTriggerClassName} w-full whitespace-normal`}
      >
        <Glyph size="3xs">{expanded ? '▼' : '▶'}</Glyph>
        <span className="flex-1">
          {expanded ? 'Hide Norwegian definition' : 'Show Norwegian definition'}
        </span>
      </button>
      {expanded ? (
        <p className="break-words pl-4 italic">
          <Text as="span" size="medium" tone="subtle">
            {text}
          </Text>
        </p>
      ) : null}
    </div>
  );
}
