import { cn } from '@/lib/utils';
import type { ReadingWordState } from '@/types/api';

interface WordSpanProps {
  text: string;
  state: ReadingWordState;
  hasLemma?: boolean;
  isInteractive: boolean;
  current?: boolean;
  onClick?: () => void;
}

const stateClassName: Record<ReadingWordState, string> = {
  new: 'word-underline-new hover:bg-neutral-subtle',
  learning: 'word-underline-learning hover:bg-neutral-subtle',
  mastered: 'text-default hover:bg-neutral-subtle',
};

const browseFallbackClassName =
  'bg-transparent text-default hover:bg-neutral-subtle';

export function WordSpan({
  text,
  state,
  hasLemma = true,
  isInteractive,
  current = false,
  onClick,
}: WordSpanProps) {
  if (!isInteractive) {
    return <span>{text}</span>;
  }

  const parts = text.match(
    /^([^\p{L}\p{N}]*)(.*[\p{L}\p{N}])([^\p{L}\p{N}]*)$/su,
  );
  const word = parts?.[2] ?? text;

  return (
    <span className={parts?.[3]?.trim() ? 'whitespace-nowrap' : undefined}>
      {parts?.[1]}
      <button
        type="button"
        aria-current={current ? 'true' : undefined}
        data-state={current ? 'current' : hasLemma ? state : 'browse'}
        data-testid={hasLemma ? 'word-button' : undefined}
        className={cn(
          'inline cursor-pointer rounded-sm border-0 bg-transparent p-0 font-inherit text-left text-inherit transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focused)]',
          current
            ? 'word-underline-current'
            : hasLemma
              ? stateClassName[state]
              : browseFallbackClassName,
        )}
        onClick={onClick}
      >
        {word}
      </button>
      {parts?.[3]}
    </span>
  );
}
