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
          className="type-caption italic text-secondary-80 text-left cursor-pointer transition-colors hover:text-secondary-100 inline bg-transparent border-0 p-0"
        >
          {example.no}
          <span
            aria-hidden="true"
            className="ml-1 align-baseline text-[10px] leading-none"
          >
            {open ? '▼' : '▶'}
          </span>
        </button>
      ) : (
        <p className="type-caption italic text-secondary-80">{example.no}</p>
      )}
      {hasEnglish ? (
        <p
          id={id}
          hidden={!open}
          className="type-caption text-muted-foreground"
        >
          {example.en}
        </p>
      ) : null}
    </div>
  );
}
