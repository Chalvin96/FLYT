import {
  AudioPlayButton,
  Button,
  Chip,
  ChoiceTile,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  InlineTrigger,
  textVariants,
} from '@flyt/ui';
import type { Meta, StoryObj } from '@storybook/react';
import {
  BookMarked,
  Clock3,
  GraduationCap,
  Headphones,
  Sparkles,
  Target,
  Volume2,
} from 'lucide-react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

import { CHATBOT_MODEL_IDS } from '@/api/chatbot';
import { useIsDesktop } from '@/hooks/ui/useIsDesktop';
import { buildRadioGroupKeyDownHandler } from '@/lib/radioGroupKeyboard';
import { cn } from '@/lib/utils';

import {
  ChatbotProvider,
  useChatbot,
  useChatbotPageContext,
} from './ChatbotProvider';
import type {
  FlytChatbotContext,
  FlytChatbotPanelProps,
} from './FlytChatbotPanel';
import { FlytChatbotPanel } from './FlytChatbotPanel';
import { CHATBOT_OPEN_STATES, type ChatbotOpenState } from './types';

type PageKind = 'lesson' | 'reading';

interface FlytChatbotPagePreviewProps {
  kind: PageKind;
  chatbotOverrides?: Partial<FlytChatbotPanelProps>;
  onTrigger?: () => void;
}

const pageContexts: Record<PageKind, FlytChatbotContext> = {
  lesson: {
    kind: 'lesson',
    label: 'Word order in main clauses',
    detail: 'Practice 2 of 5 · Which sentence follows the V2 rule?',
  },
  reading: {
    kind: 'reading',
    label: 'A morning in Bergen',
    detail: 'Paragraph 3 · The harbor is quiet before the cafés open.',
  },
};

const panelPrompts: Record<PageKind, readonly string[]> = {
  lesson: [
    'Explain the V2 rule',
    'Show me another example',
    'Give me a quick practice question',
  ],
  reading: [
    'Summarize this paragraph',
    'Explain the difficult words',
    'Ask me a comprehension question',
  ],
};

const panelMessages: Record<
  PageKind,
  NonNullable<FlytChatbotPanelProps['messages']>
> = {
  lesson: [
    {
      id: 'lesson-question',
      role: 'user',
      content: 'Why does the verb come second here?',
    },
    {
      id: 'lesson-answer',
      role: 'chatbot',
      content:
        'Norwegian main clauses follow V2: the finite verb stays in the second position, even when another phrase comes first.',
    },
  ],
  reading: [
    {
      id: 'reading-question',
      role: 'user',
      content: 'What does “før kaféene åpner” mean?',
    },
    {
      id: 'reading-answer',
      role: 'chatbot',
      content:
        'It means “before the cafés open.” The phrase sets the time for the quiet morning in Bergen.',
    },
  ],
};

const meta = {
  title: 'Pages/Chatbot/Examples',
  component: FlytChatbotPagePreview,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: { onTrigger: fn() },
} satisfies Meta<typeof FlytChatbotPagePreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LessonPage: Story = {
  args: { kind: 'lesson' },
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole('radiogroup', {
      name: 'Quick check answers',
    });
    const answers = within(group).getAllByRole('radio');

    await userEvent.click(answers[1]);
    await userEvent.keyboard('{ArrowLeft}');
    await expect(answers[0]).toHaveAttribute('aria-checked', 'true');
    await expect(answers[0]).toHaveAttribute('tabindex', '0');
    await expect(answers[0]).toHaveFocus();
    await expect(answers[1]).toHaveAttribute('tabindex', '-1');

    await userEvent.click(answers[1]);
    await expect(answers[1]).toHaveAttribute('aria-checked', 'true');
    await expect(answers[1]).toHaveAttribute('tabindex', '0');
    await expect(answers[0]).toHaveAttribute('tabindex', '-1');

    const trigger = within(canvasElement).getByRole('button', {
      name: 'Ask Flyt chatbot',
    });
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Close chatbot' }),
    );
    await expect(trigger).toHaveFocus();

    await userEvent.click(trigger);
    await expect(
      within(canvasElement).getByRole('textbox', { name: 'Ask a question' }),
    ).toHaveFocus();
  },
};

export const ReadingPage: Story = {
  args: { kind: 'reading' },
};

export const LessonPageModelChoice: Story = {
  args: {
    kind: 'lesson',
    chatbotOverrides: {
      defaultModel: CHATBOT_MODEL_IDS.CHATGPT,
    },
  },
};

export const LessonPageModelsNotConnected: Story = {
  args: {
    kind: 'lesson',
    chatbotOverrides: {
      unavailableModels: [
        CHATBOT_MODEL_IDS.CHATGPT,
        CHATBOT_MODEL_IDS.DEEPSEEK,
      ],
    },
  },
};

export const LessonPageNoModelAvailable: Story = {
  args: {
    kind: 'lesson',
    chatbotOverrides: {
      unavailableModels: [
        CHATBOT_MODEL_IDS.FLYT,
        CHATBOT_MODEL_IDS.CHATGPT,
        CHATBOT_MODEL_IDS.DEEPSEEK,
      ],
    },
  },
};

export const LessonPageFlytUnavailable: Story = {
  args: {
    kind: 'lesson',
    chatbotOverrides: {
      unavailableModels: [CHATBOT_MODEL_IDS.FLYT, CHATBOT_MODEL_IDS.DEEPSEEK],
    },
  },
};

const longConversation = Array.from({ length: 12 }, (_, index) => {
  const turn = Math.floor(index / 2) + 1;
  const isUser = index % 2 === 0;
  return {
    id: `message-${index}`,
    role: (isUser ? 'user' : 'chatbot') as 'user' | 'chatbot',
    content: isUser
      ? `Question ${turn}: why does the verb move here?`
      : `Answer ${turn}: the finite verb stays in second position, even when the clause opens with a time phrase.`,
  };
});

export const LessonPageLongConversation: Story = {
  args: {
    kind: 'lesson',
    chatbotOverrides: { messages: longConversation },
  },
};

function FlytChatbotPagePreview({
  kind,
  chatbotOverrides,
  onTrigger,
}: FlytChatbotPagePreviewProps) {
  return (
    <ChatbotProvider
      initialMessages={chatbotOverrides?.messages ?? panelMessages[kind]}
      initialOpenState={CHATBOT_OPEN_STATES.AUTO}
    >
      <PageShell
        chatbotOverrides={chatbotOverrides}
        kind={kind}
        onTrigger={onTrigger}
      />
    </ChatbotProvider>
  );
}

function PageShell({
  kind,
  chatbotOverrides,
  onTrigger,
}: Pick<
  FlytChatbotPagePreviewProps,
  'kind' | 'chatbotOverrides' | 'onTrigger'
>) {
  const isDesktop = useIsDesktop();
  const chatbotPaneRef = useRef<HTMLDivElement>(null);
  const desktopTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const desktopFocusActionRef = useRef<ChatbotOpenState | null>(null);
  const { openState, close, open } = useChatbot();

  useChatbotPageContext(pageContexts[kind]);

  const isRailOpen =
    openState === CHATBOT_OPEN_STATES.OPEN ||
    (openState === CHATBOT_OPEN_STATES.AUTO && isDesktop);
  const isDialogOpen = openState === CHATBOT_OPEN_STATES.OPEN && !isDesktop;
  const isChatbotVisible = isDesktop ? isRailOpen : isDialogOpen;

  const closeChatbot = () => {
    if (isDesktop) {
      desktopFocusActionRef.current = CHATBOT_OPEN_STATES.CLOSED;
    }
    close();
  };

  useEffect(() => {
    const action = desktopFocusActionRef.current;
    if (!isDesktop || action === null) return;

    if (action === CHATBOT_OPEN_STATES.OPEN && isRailOpen) {
      const textarea =
        chatbotPaneRef.current?.querySelector<HTMLTextAreaElement>('textarea');
      if (!textarea) return;
      textarea.focus();
      desktopFocusActionRef.current = null;
      return;
    }

    if (action === CHATBOT_OPEN_STATES.CLOSED && !isRailOpen) {
      desktopTriggerRef.current?.focus();
      desktopFocusActionRef.current = null;
    }
  }, [isDesktop, isRailOpen]);

  const toggleChatbot = () => {
    onTrigger?.();
    if (isChatbotVisible) {
      closeChatbot();
      return;
    }

    if (isDesktop) {
      desktopFocusActionRef.current = CHATBOT_OPEN_STATES.OPEN;
    }
    open();
  };

  return (
    <div
      className={cn(
        'flex h-dvh min-h-0 flex-col overflow-hidden bg-neutral',
        textVariants({ tone: 'default' }),
      )}
    >
      <PageHeader
        active={kind}
        chatbotOpen={isChatbotVisible}
        onTrigger={toggleChatbot}
        triggerRef={desktopTriggerRef}
      />
      <div
        className={cn(
          'grid min-h-0 flex-1 items-stretch overflow-hidden',
          isRailOpen
            ? 'lg:grid-cols-[minmax(0,1fr)_28rem]'
            : 'lg:grid-cols-[minmax(0,1fr)_0rem]',
        )}
      >
        <main
          className="min-h-0 min-w-0 overflow-y-auto overscroll-y-none"
          data-testid="page-main"
        >
          <div className="mx-auto w-full max-w-[64rem] px-4 pt-6 pb-24 sm:px-8 lg:pt-8 lg:pb-8">
            <PageTrail kind={kind} />
            {kind === 'lesson' ? (
              <LessonContent />
            ) : (
              <ReadingContent onTrigger={toggleChatbot} />
            )}
          </div>
        </main>
        <aside
          aria-label="Ask Flyt chatbot"
          id="flyt-chatbot-desktop"
          className={cn(
            'hidden min-h-0 min-w-0 flex-col overflow-hidden bg-raised lg:flex',
            'transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none',
            isRailOpen
              ? 'translate-x-0 border-l border-default/70 opacity-100'
              : 'translate-x-full opacity-0',
          )}
          inert={!isRailOpen}
          ref={chatbotPaneRef}
        >
          <ConnectedChatbotPanel
            chatbotOverrides={chatbotOverrides}
            kind={kind}
            onClose={closeChatbot}
          />
        </aside>
      </div>
      <MobileChatbotDialog
        chatbotOverrides={chatbotOverrides}
        isOpen={isDialogOpen && !isDesktop}
        kind={kind}
        onClose={closeChatbot}
        returnFocusRef={mobileTriggerRef}
      />
      <div className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-40 lg:hidden">
        <Button
          aria-label="Ask Flyt chatbot"
          aria-controls="flyt-chatbot-mobile"
          aria-expanded={isDialogOpen}
          aria-haspopup="dialog"
          onClick={toggleChatbot}
          ref={mobileTriggerRef}
          type="button"
        >
          <Sparkles aria-hidden="true" className="icon-sm" strokeWidth={2.1} />
          Ask Flyt
        </Button>
      </div>
    </div>
  );
}

function ConnectedChatbotPanel({
  kind,
  chatbotOverrides,
  onClose,
}: Pick<FlytChatbotPagePreviewProps, 'kind' | 'chatbotOverrides'> & {
  onClose: () => void;
}) {
  const { context, messages, dismissContext, send, startNewConversation } =
    useChatbot();
  const panelOverrides = { ...chatbotOverrides };
  delete panelOverrides.messages;

  return (
    <FlytChatbotPanel
      context={context}
      messages={messages}
      onClose={onClose}
      onContextRemove={dismissContext}
      onModelChange={() => undefined}
      onNewConversation={startNewConversation}
      onSend={send}
      onFollowUpSelect={() => undefined}
      onStarterSelect={() => undefined}
      followUpPrompts={panelPrompts[kind]}
      starterPrompts={panelPrompts[kind]}
      surface="pane"
      {...panelOverrides}
    />
  );
}

function MobileChatbotDialog({
  chatbotOverrides,
  isOpen,
  kind,
  onClose,
  returnFocusRef,
}: {
  chatbotOverrides?: Partial<FlytChatbotPanelProps>;
  isOpen: boolean;
  kind: PageKind;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => (next ? undefined : onClose())}
    >
      <DialogContent
        aria-modal="true"
        aria-describedby="flyt-chatbot-mobile-description"
        aria-labelledby="flyt-chatbot-mobile-title"
        id="flyt-chatbot-mobile"
        mobileOnly
        padding="none"
        showClose={false}
        variant="fullscreen"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusRef.current?.focus();
        }}
      >
        <DialogTitle visuallyHidden id="flyt-chatbot-mobile-title">
          Ask Flyt
        </DialogTitle>
        <DialogDescription id="flyt-chatbot-mobile-description" visuallyHidden>
          Ask questions about the current page and its attached context.
        </DialogDescription>
        <ConnectedChatbotPanel
          chatbotOverrides={chatbotOverrides}
          kind={kind}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}

function PageHeader({
  active,
  chatbotOpen = false,
  onTrigger,
  triggerRef,
}: {
  active: PageKind;
  chatbotOpen?: boolean;
  onTrigger?: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <header
      className="shrink-0 border-b border-default/70 bg-raised/90 px-4 py-3 backdrop-blur-sm sm:px-8"
      data-testid="page-header"
    >
      <div className="mx-auto flex w-full max-w-[92rem] items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-8">
          <a
            className={textVariants({
              role: 'display',
              size: 'lg',
              weight: 'semibold',
              tone: 'default',
            })}
            href="#flyt"
          >
            Flyt
          </a>
          <nav
            aria-label="Primary"
            className="hidden items-center gap-1 sm:flex"
          >
            {(['lesson', 'reading'] as const).map((item) => (
              <span
                className={cn(
                  item === active
                    ? 'radius-field bg-neutral-subtle px-3 py-2'
                    : 'px-3 py-2',
                  textVariants({
                    size: 'small',
                    weight: item === active ? 'semibold' : undefined,
                    tone: item === active ? 'default' : 'subtle',
                  }),
                )}
                key={item}
              >
                {item[0].toUpperCase() + item.slice(1)}
              </span>
            ))}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden lg:block">
            <button
              aria-controls="flyt-chatbot-desktop"
              aria-expanded={chatbotOpen}
              aria-label="Ask Flyt chatbot"
              onClick={onTrigger}
              className={cn(
                'inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap radius-section border px-3 transition-colors hover:bg-selected-hovered focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focused)] lg:px-4',
                textVariants({
                  size: 'medium',
                  weight: 'semibold',
                  tone: 'selected',
                }),
                chatbotOpen
                  ? 'border-brand-subtle bg-selected-hovered'
                  : 'border-brand-subtle bg-brand-subtle',
              )}
              type="button"
              ref={triggerRef}
            >
              <Sparkles aria-hidden="true" className="icon-sm" />
              <span className="hidden sm:inline">Ask Flyt</span>
              <span className="sr-only sm:hidden">Ask Flyt</span>
            </button>
          </div>
          <span
            aria-label="Ane’s profile"
            className={cn(
              'flex size-9 items-center justify-center rounded-full bg-neutral-pressed',
              textVariants({
                size: 'small',
                weight: 'semibold',
                tone: 'default',
              }),
            )}
          >
            A
          </span>
        </div>
      </div>
    </header>
  );
}

function PageTrail({ kind }: { kind: PageKind }) {
  const label =
    kind === 'lesson'
      ? 'Lessons / Word order in main clauses'
      : 'Reading / A morning in Bergen';

  return (
    <div
      className={cn(
        'mb-6 flex flex-wrap items-center gap-2 lg:mb-8',
        textVariants({ size: 'small', tone: 'subtle' }),
      )}
    >
      {kind === 'lesson' ? (
        <GraduationCap aria-hidden="true" className="icon-sm shrink-0" />
      ) : (
        <BookMarked aria-hidden="true" className="icon-sm shrink-0" />
      )}
      <span className="truncate">{label}</span>
    </div>
  );
}

function PageSection({
  children,
  hint,
  title,
}: {
  children: React.ReactNode;
  hint?: string;
  title: string;
}) {
  return (
    <section aria-label={title} className="space-y-4">
      <SectionHeading hint={hint} title={title} />
      {children}
    </section>
  );
}

function SectionHeading({ hint, title }: { hint?: string; title: string }) {
  return (
    <div className="flex items-center gap-4">
      <h2
        className={cn(
          'flex min-w-0 items-center gap-2.5',
          textVariants({ role: 'eyebrow', tone: 'subtle' }),
        )}
      >
        <span aria-hidden="true" className="h-px w-5 shrink-0 bg-brand-bold" />
        <span className="truncate">{title}</span>
      </h2>
      {hint ? (
        <span
          className={cn(
            'ml-auto shrink-0',
            textVariants({ size: 'small', tone: 'subtle' }),
          )}
        >
          {hint}
        </span>
      ) : null}
    </div>
  );
}

function LessonContent() {
  const [selectedQuickCheckAnswer, setSelectedQuickCheckAnswer] = useState(1);

  return (
    <div className="space-y-8 sm:space-y-10">
      <div>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full bg-brand-subtle px-2.5 py-1',
            textVariants({ role: 'eyebrow', tone: 'selected' }),
          )}
        >
          <GraduationCap aria-hidden="true" className="icon-sm" />
          A1 · grammar
        </span>
        <h1
          className={cn(
            'mt-4',
            textVariants({
              role: 'display',
              size: '3xl',
              smSize: '4xl',
              weight: 'semibold',
              tone: 'default',
            }),
          )}
        >
          Word order in main clauses
        </h1>
        <p
          className={cn(
            'mt-3 max-w-[58ch]',
            textVariants({ size: 'large', tone: 'subtle' }),
          )}
        >
          Keep the finite verb in the right place when a sentence starts with a
          time, place, or reason.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex min-w-40 flex-1 items-center gap-3 sm:max-w-xs">
            <div className="h-2 min-w-20 flex-1 overflow-hidden rounded-full bg-neutral-subtle">
              <div className="h-full w-2/5 rounded-full bg-brand-bold" />
            </div>
            <span
              className={textVariants({
                size: 'small',
                weight: 'semibold',
                tone: 'default',
              })}
            >
              2/5
            </span>
          </div>
          <span
            className={textVariants({
              size: 'small',
              tone: 'subtle',
            })}
          >
            6 min left
          </span>
        </div>
      </div>

      <PageSection title="The pattern">
        <h3
          className={textVariants({
            size: 'xl',
            weight: 'semibold',
            tone: 'default',
          })}
        >
          The finite verb stays second
        </h3>
        <p
          className={cn(
            'max-w-[64ch]',
            textVariants({ size: 'large', tone: 'default' }),
          )}
        >
          In a Norwegian main clause, the finite verb comes second. The first
          position can be the subject, a time phrase, or a place phrase.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <SentenceCard english="I read today." norwegian="Jeg leser i dag." />
          <SentenceCard
            english="Today I read."
            highlighted
            norwegian="I dag leser jeg."
          />
        </div>
      </PageSection>

      <PageSection hint="Practice 2 of 5" title="Quick check">
        <div className="radius-section border border-brand-subtle bg-brand-subtle p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-raised text-icon-brand">
              <Target aria-hidden="true" className="icon-md" />
            </span>
            <p
              className={textVariants({
                size: 'large',
                tone: 'default',
              })}
            >
              Which sentence follows the V2 rule?
            </p>
          </div>
          <div
            aria-label="Quick check answers"
            className="mt-4 flex flex-wrap gap-2"
            onKeyDown={buildRadioGroupKeyDownHandler((index) =>
              setSelectedQuickCheckAnswer(index),
            )}
            role="radiogroup"
          >
            <ChoiceTile
              layout="inline"
              onClick={() => setSelectedQuickCheckAnswer(0)}
              selected={selectedQuickCheckAnswer === 0}
              tabIndex={selectedQuickCheckAnswer === 0 ? 0 : -1}
            >
              I dag jeg leser.
            </ChoiceTile>
            <ChoiceTile
              layout="inline"
              onClick={() => setSelectedQuickCheckAnswer(1)}
              selected={selectedQuickCheckAnswer === 1}
              tabIndex={selectedQuickCheckAnswer === 1 ? 0 : -1}
            >
              I dag leser jeg.
            </ChoiceTile>
          </div>
        </div>
      </PageSection>
    </div>
  );
}

function ReadingContent({ onTrigger }: { onTrigger?: () => void }) {
  return (
    <div className="space-y-8 sm:space-y-10">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full bg-neutral-subtle px-2.5 py-1',
              textVariants({ role: 'eyebrow', tone: 'subtle' }),
            )}
          >
            <BookMarked aria-hidden="true" className="icon-sm" />
            A2 · reading
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1.5',
              textVariants({ size: 'small', tone: 'subtle' }),
            )}
          >
            <Clock3 aria-hidden="true" className="icon-sm" />5 min read
          </span>
        </div>
        <h1
          className={cn(
            'mt-5',
            textVariants({
              role: 'display',
              size: '3xl',
              smSize: '4xl',
              weight: 'semibold',
              tone: 'default',
            }),
          )}
        >
          A morning in Bergen
        </h1>
        <p
          className={cn(
            'mt-3 max-w-[58ch]',
            textVariants({ size: 'large', tone: 'subtle' }),
          )}
        >
          Read a short scene about the harbor before the cafés open. Tap a
          phrase whenever you want a little help.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="outline">
            <Headphones aria-hidden="true" className="icon-sm" />
            Listen
          </Button>
        </div>
      </div>

      <PageSection hint="Paragraph 3" title="Text">
        <article className="radius-section border border-default bg-raised p-5 shadow-soft sm:p-8">
          <div className="flex items-center justify-between gap-3 border-b border-default pb-4">
            <div
              className={cn(
                'flex items-center gap-2',
                textVariants({ size: 'small', tone: 'subtle' }),
              )}
            >
              <Volume2 aria-hidden="true" className="icon-sm" />
              <span>Read along</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                aria-label="Bookmark reading"
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <BookMarked aria-hidden="true" className="icon-sm" />
              </Button>
              <AudioPlayButton
                label="Play reading audio"
                presentation="compact"
                size="sm"
                src="data:audio/wav;base64,UklGRhQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="
              />
            </div>
          </div>
          <div
            className={cn(
              'mt-6 space-y-5',
              textVariants({ size: 'large', tone: 'default' }),
            )}
          >
            <p>
              Det er tidlig morgen i Bergen. Havnen er stille{' '}
              <InlineTrigger onClick={onTrigger}>
                før kaféene åpner
              </InlineTrigger>
              .
            </p>
            <p>
              En mann går langs bryggen med en varm kopp kaffe. Han stopper og
              ser på båtene som ligger i vannet.
            </p>
            <blockquote
              className={cn(
                'border-l-2 border-brand-subtle pl-4',
                textVariants({ tone: 'subtle' }),
              )}
            >
              “Det blir en fin dag,” tenker han.
            </blockquote>
          </div>
        </article>
      </PageSection>

      <PageSection hint="Tap to look up" title="Words to watch">
        <div className="radius-field bg-neutral-subtle p-4 sm:p-5">
          <div className="flex flex-wrap gap-2">
            <VocabChip english="early" norwegian="tidlig" />
            <VocabChip english="quiet" norwegian="stille" />
            <VocabChip english="the pier" norwegian="bryggen" />
            <VocabChip english="thinks" norwegian="tenker" />
          </div>
          <p
            className={cn(
              'mt-4 flex items-start gap-2',
              textVariants({ size: 'small', tone: 'subtle' }),
            )}
          >
            <Sparkles
              aria-hidden="true"
              className="icon-sm shrink-0 text-icon-brand"
            />
            Select text in the story to ask Flyt about it.
          </p>
        </div>
      </PageSection>
    </div>
  );
}

function VocabChip({
  english,
  norwegian,
}: {
  english: string;
  norwegian: string;
}) {
  return (
    <Chip aria-label={`Look up ${norwegian}`} variant="suggestion">
      <span className={textVariants({ weight: 'semibold' })}>{norwegian}</span>
      <span className={cn('ml-1.5', textVariants({ tone: 'subtle' }))}>
        {english}
      </span>
    </Chip>
  );
}

function SentenceCard({
  english,
  highlighted = false,
  norwegian,
}: {
  english: string;
  highlighted?: boolean;
  norwegian: string;
}) {
  return (
    <div
      className={
        highlighted
          ? 'radius-field border border-brand-subtle bg-brand-subtle p-4'
          : 'radius-field border border-default bg-neutral p-4'
      }
    >
      <p
        className={textVariants({
          size: 'large',
          weight: 'semibold',
          tone: 'default',
        })}
      >
        {norwegian}
      </p>
      <p
        className={cn(
          'mt-1',
          textVariants({
            size: 'medium',
            tone: highlighted ? 'default' : 'subtle',
          }),
        )}
      >
        {english}
      </p>
    </div>
  );
}
