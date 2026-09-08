import { ArrowUp } from 'lucide-react';
import { useId } from 'react';
import type { FormEvent, ReactNode, RefObject } from 'react';

import { Button } from '@/components/common/Button/Button';
import { cn } from '@/lib/utils';

import { hasAttachedSource } from './chatbotContext';
import { ContextPill } from './FlytChatbotContextElements';
import { ModelPills } from './FlytChatbotModelPicker';
import type { FlytChatbotContext, FlytChatbotModel } from './types';

const CHATBOT_MESSAGE_MAX_CHARACTERS = 4_000;
export function ChatbotComposer({
  activeModel,
  composerState,
  context,
  draft,
  flytRemainingPercent,
  isModelUsable,
  modelActions,
  modelReasons,
  onContextRemove,
  onDraftChange,
  onModelChange,
  onSubmit,
  textareaRef,
}: {
  activeModel: FlytChatbotModel | null;
  composerState: {
    canSend: boolean;
    loading: boolean;
    availabilityNotice: string | null;
  };
  context: FlytChatbotContext | null | undefined;
  draft: string;
  flytRemainingPercent: number | null;
  isModelUsable: (model: FlytChatbotModel) => boolean;
  modelActions: Partial<Record<FlytChatbotModel, string | null>>;
  modelReasons: Partial<Record<FlytChatbotModel, string | null>>;
  onContextRemove?: (context: FlytChatbotContext) => void;
  onDraftChange: (draft: string) => void;
  onModelChange: (model: FlytChatbotModel) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const textareaId = useId();

  return (
    <form
      aria-label="Ask the chatbot"
      className="group/composer min-w-0 border-t border-border/70 bg-card px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4"
      onSubmit={onSubmit}
    >
      <div
        className={cn(
          'relative radius-field border border-secondary-60 bg-background transition-colors',
          'focus-within:border-primary-70 focus-within:ring-2 focus-within:ring-primary-20',
        )}
        data-testid="chatbot-input-well"
      >
        {context ? (
          <div className="px-3 pt-2.5">
            <ContextPill context={context} onRemove={onContextRemove} />
          </div>
        ) : null}
        <div className={cn('px-3 pb-2.5 pr-14', context ? 'pt-2' : 'pt-2.5')}>
          <label className="sr-only" htmlFor={textareaId}>
            Ask a question
          </label>
          <textarea
            ref={textareaRef}
            id={textareaId}
            className="max-h-[120px] min-h-11 w-full resize-none field-sizing-content bg-transparent type-caption leading-6 text-foreground outline-none placeholder:text-muted-foreground"
            disabled={composerState.loading}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={
              hasAttachedSource(context)
                ? 'Ask about this context…'
                : 'Ask anything about Norwegian…'
            }
            rows={2}
            maxLength={CHATBOT_MESSAGE_MAX_CHARACTERS}
            value={draft}
          />
        </div>
        <Button
          aria-label="Send message"
          className="absolute bottom-1.5 right-1.5 size-11 bg-primary-80 p-0 hover:bg-primary-90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
          disabled={!composerState.canSend}
          type="submit"
        >
          <ArrowUp className="icon-sm" strokeWidth={2.2} />
        </Button>
      </div>
      <ModelPills
        activeModel={activeModel}
        isModelUsable={isModelUsable}
        modelActions={modelActions}
        modelReasons={modelReasons}
        onModelChange={onModelChange}
      />
      {activeModel === 'flyt' && flytRemainingPercent !== null ? (
        <p
          className="mt-1.5 type-caption-sm text-muted-foreground"
          data-testid="chatbot-flyt-usage"
        >
          {flytRemainingPercent}% left
        </p>
      ) : null}
      {composerState.availabilityNotice ? (
        <p
          className="mt-1.5 type-caption-sm font-medium text-warning-90"
          data-testid="chatbot-availability-notice"
        >
          {composerState.availabilityNotice}
        </p>
      ) : null}
      <p className="mt-1.5 hidden text-right type-caption-sm text-muted-foreground md:group-has-[textarea:focus]/composer:block">
        Shift + Enter for a new line
      </p>
    </form>
  );
}

export function IconButton({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="flex size-11 cursor-pointer items-center justify-center rounded-full text-secondary-80 transition-colors hover:bg-secondary-10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      onClick={onClick}
      type="button"
    >
      <span aria-hidden="true" className="[&_svg]:icon-sm">
        {children}
      </span>
    </button>
  );
}
