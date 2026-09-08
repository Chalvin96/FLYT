import { cn } from '@/lib/utils';
import type { ReadingWordState } from '@/types/api';

interface WordSpanProps {
  text: string;
  state: ReadingWordState;
  hasLemma?: boolean;
  isInteractive: boolean;
  onClick?: () => void;
}

const stateClassName: Record<ReadingWordState, string> = {
  new: 'word-underline-new hover:opacity-80',
  learning: 'word-underline-learning hover:opacity-80',
  mastered: 'text-foreground hover:bg-secondary-10',
};

const browseFallbackClassName =
  'bg-transparent text-foreground hover:bg-secondary-10';

export function WordSpan({
  text,
  state,
  hasLemma = true,
  isInteractive,
  onClick,
}: WordSpanProps) {
  if (!isInteractive) {
    return <span>{text}</span>;
  }

  return (
    <span
      role="button"
      tabIndex={0}
      data-testid={hasLemma ? 'word-button' : undefined}
      className={cn(
        'inline cursor-pointer rounded px-0.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        hasLemma ? stateClassName[state] : browseFallbackClassName,
      )}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick?.();
        }
      }}
    >
      {text}
    </span>
  );
}
