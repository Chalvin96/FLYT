import { Bot } from 'lucide-react';

import { hasAttachedSource } from './chatbotContext';
import type { FlytChatbotContext } from './types';

const PROMPT_ACTION_LIMIT = 3;
export function EmptyState({
  context,
  prompts,
  onPromptSelect,
}: {
  context: FlytChatbotContext | null | undefined;
  prompts: readonly string[];
  onPromptSelect: (prompt: string) => void;
}) {
  return (
    <div className="flex min-h-56 w-full flex-1 flex-col items-center justify-end px-4 pb-2 text-center">
      <span className="flex size-14 shrink-0 items-center justify-center radius-section border border-border bg-secondary-5 text-primary-70">
        <Bot aria-hidden="true" className="icon-lg" strokeWidth={1.7} />
      </span>
      <h3 className="mt-4 font-display type-lead font-semibold text-foreground">
        {hasAttachedSource(context)
          ? 'Ask about this context'
          : 'What do you want to ask?'}
      </h3>
      <p className="mt-1.5 max-w-[34ch] type-caption-sm leading-5 text-muted-foreground">
        {hasAttachedSource(context)
          ? 'I can use the attached lesson, story, or selection.'
          : 'Ask anything about Norwegian, or open the chatbot from a lesson or story for context.'}
      </p>
      <div className="mt-6 w-full text-left">
        <PromptActions prompts={prompts} onPromptSelect={onPromptSelect} />
      </div>
    </div>
  );
}

export function PromptActions({
  prompts,
  onPromptSelect,
}: {
  prompts: readonly string[];
  onPromptSelect: (prompt: string) => void;
}) {
  return (
    <div className="w-full space-y-2">
      {prompts.slice(0, PROMPT_ACTION_LIMIT).map((prompt) => (
        <button
          className="flex min-h-11 w-full cursor-pointer items-center radius-field border border-border bg-secondary-5 px-3 py-2 text-left type-caption-sm font-medium text-foreground transition-colors hover:border-primary-30 hover:bg-primary-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          key={prompt}
          onClick={() => onPromptSelect(prompt)}
          type="button"
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
