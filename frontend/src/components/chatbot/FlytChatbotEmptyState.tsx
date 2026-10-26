import { Button, Heading, Text } from '@flyt/ui';

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
      <div className="mt-4">
        <Heading as="h3" size="medium" tone="default">
          {hasAttachedSource(context)
            ? 'Ask about this context'
            : 'What do you want to ask?'}
        </Heading>
      </div>
      <div className="mt-1.5 max-w-68">
        <Text as="p" size="small" tone="subtle">
          {hasAttachedSource(context)
            ? 'I can use the attached lesson, story, or selection.'
            : 'Ask anything about Norwegian, or open the chatbot from a lesson or story for context.'}
        </Text>
      </div>
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
        <Button
          align="start"
          key={prompt}
          onClick={() => onPromptSelect(prompt)}
          size="sm"
          type="button"
          variant="outline"
          width="full"
        >
          {prompt}
        </Button>
      ))}
    </div>
  );
}
