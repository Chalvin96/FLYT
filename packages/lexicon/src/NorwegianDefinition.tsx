import { useState } from 'react';
import { Button } from '@flyt/ui';

export function NorwegianDefinition({
  text,
}: {
  text: string | null | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="!px-0 !py-0 h-auto w-full whitespace-normal text-left type-caption font-medium text-secondary-70 transition-colors hover:text-secondary-90 flex items-center gap-1.5 justify-start"
      >
        <span aria-hidden="true" className="text-[10px] leading-none">
          {expanded ? '▼' : '▶'}
        </span>
        <span className="flex-1">
          {expanded ? 'Hide Norwegian definition' : 'Show Norwegian definition'}
        </span>
      </Button>
      {expanded ? (
        <p className="type-caption break-words pl-4 italic text-secondary-70">
          {text}
        </p>
      ) : null}
    </div>
  );
}
