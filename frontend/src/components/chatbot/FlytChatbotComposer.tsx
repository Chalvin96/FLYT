import { Button, Text, textVariants } from '@flyt/ui';
import { ArrowUp } from 'lucide-react';
import { useId } from 'react';
import type { FormEvent, KeyboardEvent, ReactNode, RefObject } from 'react';

import { CHATBOT_MODEL_IDS } from '@/api/chatbot';
import type { AccountPageAnchor } from '@/components/nav/accountNavigation';
import { useIsDesktop } from '@/hooks/ui/useIsDesktop';
import { cn } from '@/lib/utils';

import { hasAttachedSource } from './chatbotContext';
import { ContextPill } from './FlytChatbotContextElements';
import { ModelPills } from './FlytChatbotModelPicker';
import type {
  ChatbotAvailabilityStatus,
  FlytChatbotContext,
  FlytChatbotModel,
} from './types';

const CHATBOT_MESSAGE_MAX_CHARACTERS = 4_000;
const IME_COMPOSING_KEY_CODE = 229;

export function ChatbotComposer({
  activeModel,
  availabilityStatus,
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
  onOpenAccountSettings,
  onRetryAvailability,
  onSubmit,
  textareaRef,
}: {
  activeModel: FlytChatbotModel | null;
  availabilityStatus: ChatbotAvailabilityStatus;
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
  onOpenAccountSettings?: (anchor: AccountPageAnchor) => void;
  onRetryAvailability?: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const textareaId = useId();
  const isDesktop = useIsDesktop();

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.nativeEvent.isComposing ||
      event.keyCode === IME_COMPOSING_KEY_CODE
    )
      return;
    if (event.key !== 'Enter') return;
    if (!isDesktop || event.shiftKey) return;

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  return (
    <form
      aria-label="Ask the chatbot"
      className="group/composer min-w-0 border-t border-default/70 bg-raised px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4"
      onSubmit={onSubmit}
    >
      <div
        className="relative radius-field border border-strong bg-neutral focus-within:border-selected focus-within:ring-2 focus-within:ring-[var(--border-focused)]"
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
            className={`max-h-[120px] min-h-11 w-full resize-none field-sizing-content bg-transparent outline-none placeholder:text-subtle ${textVariants({ size: 'medium', tone: 'default' })}`}
            disabled={composerState.loading}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={handleKeyDown}
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
        <span className="absolute right-1.5 bottom-1.5">
          <Button
            aria-label="Send message"
            disabled={!composerState.canSend}
            size="icon"
            type="submit"
          >
            <ArrowUp strokeWidth={2.2} />
          </Button>
        </span>
      </div>
      <ModelPills
        activeModel={activeModel}
        availabilityStatus={availabilityStatus}
        isModelUsable={isModelUsable}
        modelActions={modelActions}
        modelReasons={modelReasons}
        onModelChange={onModelChange}
        onOpenAccountSettings={onOpenAccountSettings}
        onRetryAvailability={onRetryAvailability}
      />
      {activeModel === CHATBOT_MODEL_IDS.FLYT &&
      flytRemainingPercent !== null ? (
        <div className="mt-1.5">
          <Text
            as="p"
            data-testid="chatbot-flyt-usage"
            size="small"
            tone="subtle"
          >
            {flytRemainingPercent}% left
          </Text>
        </div>
      ) : null}
      {composerState.availabilityNotice ? (
        <div className="mt-1.5 text-warning">
          <Text as="p" data-testid="chatbot-availability-notice" size="small">
            {composerState.availabilityNotice}
          </Text>
        </div>
      ) : null}
      <div className="mt-1.5 hidden min-h-4 text-right lg:block">
        <Text
          as="p"
          data-testid="chatbot-composer-hint"
          size="small"
          tone="subtle"
        >
          Enter to send · Shift + Enter for a new line
        </Text>
      </div>
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
    <Button
      aria-label={label}
      onClick={onClick}
      shape="pill"
      size="icon"
      type="button"
      variant="ghost"
    >
      <span aria-hidden="true">{children}</span>
    </Button>
  );
}
