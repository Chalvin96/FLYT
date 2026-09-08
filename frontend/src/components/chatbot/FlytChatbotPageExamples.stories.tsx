import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { Meta, StoryObj } from '@storybook/react';
import {
  ArrowRight,
  BookMarked,
  BookOpenText,
  Check,
  Clock3,
  Flame,
  GraduationCap,
  Headphones,
  Home,
  Play,
  Sparkles,
  Target,
  Volume2,
} from 'lucide-react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import {
  Dialog,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog';
import { useIsDesktop } from '@/hooks/ui/useIsDesktop';
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

type PageKind = 'general' | 'lesson' | 'reading';

interface FlytChatbotPagePreviewProps {
  kind: PageKind;
  chatbotOverrides?: Partial<FlytChatbotPanelProps>;
  onTrigger?: () => void;
  initialChatbotOpen?: boolean;
  initialRailOpen?: boolean;
}

const pageContexts: Record<PageKind, FlytChatbotContext> = {
  general: {
    kind: 'general',
    label: 'Home dashboard',
    detail: 'Today’s practice and reading progress',
  },
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
  general: [
    'Explain this simply',
    'Give me an example',
    'What should I practice next?',
  ],
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
  general: [],
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
  title: 'Chatbot/Whole page examples',
  component: FlytChatbotPagePreview,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: { onTrigger: fn() },
} satisfies Meta<typeof FlytChatbotPagePreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const GeneralPage: Story = {
  args: { kind: 'general' },
};

export const LessonPage: Story = {
  args: { kind: 'lesson' },
};

export const ReadingPage: Story = {
  args: { kind: 'reading' },
};

export const LessonPageModelChoice: Story = {
  args: {
    kind: 'lesson',
    chatbotOverrides: {
      defaultModel: 'chatgpt',
    },
  },
};

export const LessonPageModelsNotConnected: Story = {
  args: {
    kind: 'lesson',
    chatbotOverrides: { unavailableModels: ['chatgpt', 'deepseek'] },
  },
};

export const LessonPageNoModelAvailable: Story = {
  args: {
    kind: 'lesson',
    chatbotOverrides: {
      unavailableModels: ['flyt', 'chatgpt', 'deepseek'],
    },
  },
};

export const LessonPageFlytUnavailable: Story = {
  args: {
    kind: 'lesson',
    chatbotOverrides: {
      unavailableModels: ['flyt', 'deepseek'],
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

export const LessonPageRailClosed: Story = {
  args: { kind: 'lesson', initialRailOpen: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', {
      name: 'Ask Flyt chatbot',
    });

    await userEvent.click(trigger);
    await expect(
      canvas.getByRole('textbox', { name: 'Ask a question' }),
    ).toHaveFocus();

    await userEvent.click(
      canvas.getByRole('button', { name: 'Close chatbot' }),
    );
    await expect(trigger).toHaveFocus();
  },
};

export const LessonPageMobile: Story = {
  args: { kind: 'lesson' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

export const ReadingPageMobile: Story = {
  args: { kind: 'reading' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

export const GeneralPageMobile: Story = {
  args: { kind: 'general' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

function FlytChatbotPagePreview({
  kind,
  chatbotOverrides,
  initialChatbotOpen = false,
  initialRailOpen = true,
  onTrigger,
}: FlytChatbotPagePreviewProps) {
  return (
    <ChatbotProvider
      initialMessages={chatbotOverrides?.messages ?? panelMessages[kind]}
      initialOpenState={
        !initialRailOpen ? 'closed' : initialChatbotOpen ? 'open' : 'auto'
      }
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
  const desktopFocusActionRef = useRef<'open' | 'close' | null>(null);
  const { openState, close, open } = useChatbot();

  useChatbotPageContext(pageContexts[kind]);

  const isRailOpen = openState !== 'closed';
  const isDialogOpen = openState === 'open';
  const isChatbotVisible = isDesktop ? isRailOpen : isDialogOpen;

  const closeChatbot = () => {
    if (isDesktop) desktopFocusActionRef.current = 'close';
    close();
  };

  useEffect(() => {
    const action = desktopFocusActionRef.current;
    if (!isDesktop || action === null) return;

    if (action === 'open' && isRailOpen) {
      const textarea =
        chatbotPaneRef.current?.querySelector<HTMLTextAreaElement>('textarea');
      if (!textarea) return;
      textarea.focus();
      desktopFocusActionRef.current = null;
      return;
    }

    if (action === 'close' && !isRailOpen) {
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

    if (isDesktop) desktopFocusActionRef.current = 'open';
    open();
  };

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <PageHeader
        active={kind}
        chatbotOpen={isChatbotVisible}
        onTrigger={toggleChatbot}
        triggerRef={desktopTriggerRef}
      />
      <div
        className={cn(
          'grid min-h-0 flex-1 items-stretch transition-[grid-template-columns] duration-300 ease-out motion-reduce:transition-none',
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
            {kind === 'general' ? (
              <GeneralContent />
            ) : kind === 'lesson' ? (
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
            'hidden min-h-0 min-w-0 flex-col overflow-hidden bg-card lg:flex',
            isRailOpen && 'border-l border-border/70',
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
      <button
        aria-label="Ask Flyt chatbot"
        aria-controls="flyt-chatbot-mobile"
        aria-expanded={isDialogOpen}
        aria-haspopup="dialog"
        className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-40 inline-flex min-h-12 items-center gap-2 radius-field bg-primary-80 px-4 type-caption font-semibold text-white-100 shadow-raised transition-colors hover:bg-primary-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:hidden"
        onClick={toggleChatbot}
        ref={mobileTriggerRef}
        type="button"
      >
        <Sparkles aria-hidden="true" className="icon-sm" />
        Ask Flyt
      </button>
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
      <DialogPortal>
        <DialogOverlay className="bg-black-80 lg:hidden" />
        <DialogPrimitive.Content
          aria-modal="true"
          aria-describedby="flyt-chatbot-mobile-description"
          aria-labelledby="flyt-chatbot-mobile-title"
          className="fixed inset-0 z-50 flex h-dvh min-h-0 w-full flex-col bg-background outline-none lg:hidden"
          id="flyt-chatbot-mobile"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocusRef.current?.focus();
          }}
        >
          <DialogTitle className="sr-only" id="flyt-chatbot-mobile-title">
            Ask Flyt
          </DialogTitle>
          <DialogDescription
            className="sr-only"
            id="flyt-chatbot-mobile-description"
          >
            Ask questions about the current page and its attached context.
          </DialogDescription>
          <ConnectedChatbotPanel
            chatbotOverrides={chatbotOverrides}
            kind={kind}
            onClose={onClose}
          />
        </DialogPrimitive.Content>
      </DialogPortal>
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
      className="shrink-0 border-b border-border/70 bg-card/90 px-4 py-3 backdrop-blur sm:px-8"
      data-testid="page-header"
    >
      <div className="container-max mx-auto flex w-full max-w-[92rem] items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-8">
          <a
            className="font-display type-section font-semibold tracking-tight text-foreground"
            href="#flyt"
          >
            Flyt
          </a>
          <nav
            aria-label="Primary"
            className="hidden items-center gap-1 sm:flex"
          >
            {(['general', 'lesson', 'reading'] as const).map((item) => (
              <span
                className={
                  item === active
                    ? 'radius-field bg-secondary-10 px-3 py-2 type-caption-sm font-semibold text-foreground'
                    : 'px-3 py-2 type-caption-sm text-muted-foreground'
                }
                key={item}
              >
                {item === 'general'
                  ? 'Home'
                  : item[0].toUpperCase() + item.slice(1)}
              </span>
            ))}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            aria-controls="flyt-chatbot-desktop"
            aria-expanded={chatbotOpen}
            aria-label="Ask Flyt chatbot"
            className={cn(
              'hidden min-h-11 items-center gap-2 radius-field border px-3 type-caption-sm font-semibold text-primary-90 transition-colors hover:border-primary-50 hover:bg-primary-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:inline-flex',
              chatbotOpen
                ? 'border-primary-50 bg-primary-10'
                : 'border-primary-30 bg-primary-5',
            )}
            onClick={onTrigger}
            ref={triggerRef}
            type="button"
          >
            <Sparkles aria-hidden="true" className="icon-sm" />
            Ask Flyt
          </button>
          <span
            aria-label="Ane’s profile"
            className="flex size-9 items-center justify-center rounded-full bg-secondary-20 type-caption-sm font-semibold text-secondary-90"
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
    kind === 'general'
      ? 'Home'
      : kind === 'lesson'
        ? 'Lessons / Word order in main clauses'
        : 'Reading / A morning in Bergen';

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 type-caption-sm text-muted-foreground lg:mb-8">
      {kind === 'general' ? (
        <Home aria-hidden="true" className="icon-sm shrink-0" />
      ) : kind === 'lesson' ? (
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
      <h2 className="flex min-w-0 items-center gap-2.5 type-label-sm text-muted-foreground">
        <span aria-hidden="true" className="h-px w-5 shrink-0 bg-primary-50" />
        <span className="truncate">{title}</span>
      </h2>
      {hint ? (
        <span className="ml-auto shrink-0 type-caption-sm text-muted-foreground">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

function GeneralContent() {
  return (
    <div className="space-y-8 sm:space-y-10">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="type-label-sm text-primary-70">Tuesday, 28 August</p>
            <h1 className="mt-3 font-display type-title-lg font-semibold tracking-tight text-foreground sm:type-display">
              Good morning, Ane.
            </h1>
            <p className="mt-3 max-w-[46ch] type-body text-muted-foreground">
              Keep your Norwegian moving with a short lesson and one small
              reading today.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-accent-10 px-3 py-2 type-caption-sm font-semibold text-accent-100">
            <Flame aria-hidden="true" className="icon-sm" />
            12 day streak
          </span>
        </div>
        <div className="mt-7 flex flex-wrap gap-3">
          <PageButton>Start practice</PageButton>
        </div>
      </div>

      <PageSection title="Today at a glance">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat icon={<Clock3 />} label="Today" value="8 min" />
          <Stat icon={<Target />} label="This week" value="72%" />
          <Stat icon={<BookOpenText />} label="Words reviewed" value="148" />
        </div>
      </PageSection>

      <PageSection title="Continue">
        <div className="radius-section border border-border bg-card p-5 shadow-soft sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-display type-lead font-semibold text-foreground">
                Word order in main clauses
              </h3>
              <p className="mt-1 type-caption text-muted-foreground">
                Practice 2 of 5 · about 6 minutes left
              </p>
            </div>
            <button
              aria-label="Open word order lesson"
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary-10 text-secondary-80 transition-colors hover:bg-secondary-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              type="button"
            >
              <ArrowRight aria-hidden="true" className="icon-sm" />
            </button>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-secondary-10">
            <div className="h-full w-2/5 rounded-full bg-primary-60" />
          </div>
          <p className="mt-2 type-caption-sm text-muted-foreground">
            40% complete
          </p>
        </div>
      </PageSection>

      <PageSection hint="This week" title="Recent practice">
        <ul className="divide-y divide-border" role="list">
          <PracticeRow label="Past tense with var" meta="Yesterday" />
          <PracticeRow label="A morning in Bergen" meta="Monday" />
          <PracticeRow label="Question words" meta="Sunday" />
        </ul>
      </PageSection>
    </div>
  );
}

function LessonContent() {
  return (
    <div className="space-y-8 sm:space-y-10">
      <div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-5 px-2.5 py-1 type-label-sm text-primary-90">
          <GraduationCap aria-hidden="true" className="icon-sm" />
          A1 · Grammar
        </span>
        <h1 className="mt-4 font-display type-title-lg font-semibold tracking-tight text-foreground sm:type-display">
          Word order in main clauses
        </h1>
        <p className="mt-3 max-w-[58ch] type-body text-muted-foreground">
          Keep the finite verb in the right place when a sentence starts with a
          time, place, or reason.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex min-w-40 flex-1 items-center gap-3 sm:max-w-xs">
            <div className="h-2 min-w-20 flex-1 overflow-hidden rounded-full bg-secondary-10">
              <div className="h-full w-2/5 rounded-full bg-primary-60" />
            </div>
            <span className="type-caption-sm font-semibold text-foreground">
              2/5
            </span>
          </div>
          <span className="type-caption-sm text-muted-foreground">
            6 min left
          </span>
        </div>
      </div>

      <PageSection title="The pattern">
        <h3 className="font-display type-lead font-semibold text-foreground">
          The finite verb stays second
        </h3>
        <p className="max-w-[64ch] type-body leading-7 text-secondary-90">
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
        <div className="radius-section border border-primary-20 bg-primary-5 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-primary-70">
              <Target aria-hidden="true" className="icon-md" />
            </span>
            <p className="type-body font-medium text-foreground">
              Which sentence follows the V2 rule?
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="inline-flex min-h-10 items-center radius-field border border-border bg-card px-4 py-2 type-caption-sm text-foreground transition-colors hover:bg-secondary-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              type="button"
            >
              I dag jeg leser.
            </button>
            <button
              className="inline-flex min-h-10 items-center radius-field border border-primary-50 bg-primary-10 px-4 py-2 type-caption-sm font-semibold text-primary-90 transition-colors hover:border-primary-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              type="button"
            >
              I dag leser jeg.
            </button>
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-10 px-2.5 py-1 type-label-sm text-secondary-80">
            <BookMarked aria-hidden="true" className="icon-sm" />
            A2 · Reading
          </span>
          <span className="inline-flex items-center gap-1.5 type-caption-sm text-muted-foreground">
            <Clock3 aria-hidden="true" className="icon-sm" />5 min read
          </span>
        </div>
        <h1 className="mt-5 font-display type-title-lg font-semibold tracking-tight text-foreground sm:type-display">
          A morning in Bergen
        </h1>
        <p className="mt-3 max-w-[58ch] type-body text-muted-foreground">
          Read a short scene about the harbor before the cafés open. Tap a
          phrase whenever you want a little help.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <PageButton variant="outline">
            <Headphones aria-hidden="true" className="icon-sm" />
            Listen
          </PageButton>
        </div>
      </div>

      <PageSection hint="Paragraph 3" title="Text">
        <article className="radius-section border border-border bg-card p-5 shadow-soft sm:p-8">
          <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
            <div className="flex items-center gap-2 type-caption-sm text-muted-foreground">
              <Volume2 aria-hidden="true" className="icon-sm" />
              <span>Read along</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                aria-label="Bookmark reading"
                className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary-10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                type="button"
              >
                <BookMarked aria-hidden="true" className="icon-sm" />
              </button>
              <button
                aria-label="Play reading audio"
                className="flex size-9 items-center justify-center rounded-full bg-secondary-10 text-secondary-80 transition-colors hover:bg-secondary-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                type="button"
              >
                <Play aria-hidden="true" className="icon-sm" />
              </button>
            </div>
          </div>
          <div className="mt-6 space-y-5 type-body leading-8 text-secondary-90">
            <p>
              Det er tidlig morgen i Bergen. Havnen er stille{' '}
              <button
                className="rounded-sm bg-primary-10 px-1 text-primary-90 underline decoration-primary-40 decoration-2 underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={onTrigger}
                type="button"
              >
                før kaféene åpner
              </button>
              .
            </p>
            <p>
              En mann går langs bryggen med en varm kopp kaffe. Han stopper og
              ser på båtene som ligger i vannet.
            </p>
            <blockquote className="border-l-2 border-primary-40 pl-4 text-secondary-80">
              “Det blir en fin dag,” tenker han.
            </blockquote>
          </div>
        </article>
      </PageSection>

      <PageSection hint="Tap to look up" title="Words to watch">
        <div className="radius-field bg-muted p-4 sm:p-5">
          <div className="flex flex-wrap gap-2">
            <VocabChip english="early" norwegian="tidlig" />
            <VocabChip english="quiet" norwegian="stille" />
            <VocabChip english="the pier" norwegian="bryggen" />
            <VocabChip english="thinks" norwegian="tenker" />
          </div>
          <p className="mt-4 flex items-start gap-2 type-caption-sm text-muted-foreground">
            <Sparkles
              aria-hidden="true"
              className="icon-sm shrink-0 text-primary-70"
            />
            Select text in the story to ask Flyt about it.
          </p>
        </div>
      </PageSection>
    </div>
  );
}

function PageButton({
  children,
  onClick,
  variant = 'primary',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'outline';
}) {
  return (
    <button
      className={
        variant === 'primary'
          ? 'inline-flex min-h-11 items-center gap-2 radius-field bg-primary-80 px-4 type-caption font-semibold text-white-100 transition-colors hover:bg-primary-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          : 'inline-flex min-h-11 items-center gap-2 radius-field border border-border bg-card px-4 type-caption font-semibold text-foreground transition-colors hover:bg-secondary-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      }
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="radius-field bg-card p-4">
      <span className="flex size-9 items-center justify-center rounded-full bg-primary-5 text-primary-70 [&_svg]:icon-sm">
        {icon}
      </span>
      <p className="mt-3 font-display type-stat text-foreground">{value}</p>
      <p className="mt-1 type-caption-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function PracticeRow({ label, meta }: { label: string; meta: string }) {
  return (
    <li className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary-10 text-secondary-80">
          <Check aria-hidden="true" className="icon-sm" />
        </span>
        <span className="truncate type-caption text-foreground">{label}</span>
      </div>
      <span className="shrink-0 type-caption-sm text-muted-foreground">
        {meta}
      </span>
    </li>
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
    <button
      aria-label={`Look up ${norwegian}`}
      className="radius-field border border-border/70 bg-background px-3 py-1.5 type-caption-sm text-foreground transition-colors hover:border-primary-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      type="button"
    >
      <span className="font-semibold">{norwegian}</span>
      <span className="ml-1.5 text-muted-foreground">{english}</span>
    </button>
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
          ? 'radius-field border border-primary-30 bg-primary-5 p-4'
          : 'radius-field border border-border bg-secondary-5 p-4'
      }
    >
      <p className="type-body font-semibold text-foreground">{norwegian}</p>
      <p className="mt-1 type-caption text-muted-foreground">{english}</p>
    </div>
  );
}
