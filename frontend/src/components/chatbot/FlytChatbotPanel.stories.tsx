import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';

import { FlytChatbotPanel } from './FlytChatbotPanel';

const lessonContext = {
  kind: 'lesson' as const,
  label: 'Word order in main clauses',
  detail: 'Practice 2 of 5 · Which sentence follows the V2 rule?',
};

const readingContext = {
  kind: 'reading' as const,
  label: 'A morning in Bergen',
  detail: 'Paragraph 3 · The harbor is quiet before the cafés open.',
};

const selectionContext = {
  kind: 'selection' as const,
  label: 'fordi jeg ikke kan komme',
  detail: 'Selected from “Jeg blir hjemme fordi jeg ikke kan komme.”',
};

const meta = {
  title: 'Chatbot/FlytChatbotPanel',
  component: FlytChatbotPanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div className="flex min-h-screen justify-end bg-background">
        <div className="flex h-screen w-full max-w-[420px] flex-col overflow-hidden border-l border-border/70">
          <Story />
        </div>
      </div>
    ),
  ],
  args: {
    surface: 'pane',
    onClose: fn(),
    onContextRemove: fn(),
    onErrorDismiss: fn(),
    onErrorRetry: fn(),
    onModelChange: fn(),
    onNewConversation: fn(),
    onSend: fn(),
    onFollowUpSelect: fn(),
    onStarterSelect: fn(),
  },
} satisfies Meta<typeof FlytChatbotPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const General: Story = {};

export const CurrentScreenContext: Story = {
  args: {
    context: {
      kind: 'general',
      label: 'Home dashboard',
      detail: 'Today’s practice and reading progress',
    },
  },
};

export const LessonContext: Story = {
  args: {
    context: lessonContext,
    starterPrompts: [
      'Explain the V2 rule',
      'Show me another example',
      'Give me a quick practice question',
    ],
  },
};

export const ReadingContext: Story = {
  args: {
    context: readingContext,
    starterPrompts: [
      'Summarize this paragraph',
      'Explain the difficult words',
      'Ask me a comprehension question',
    ],
  },
};

export const SelectedText: Story = {
  args: {
    context: selectionContext,
    starterPrompts: [
      'Explain this phrase',
      'Show the grammar pattern',
      'Use it in another sentence',
    ],
  },
};

export const ConversationWithChatGPT: Story = {
  args: {
    context: lessonContext,
    defaultModel: 'chatgpt',
    messages: [
      {
        id: 'question-1',
        role: 'user',
        content: 'Why is spiser in second position here?',
      },
      {
        id: 'answer-1',
        role: 'chatbot',
        content:
          'Norwegian main clauses use the V2 rule: the finite verb comes second, even when the sentence starts with a time phrase like “I dag”.',
      },
      {
        id: 'question-2',
        role: 'user',
        content: 'Can you give me one more example?',
      },
      {
        id: 'answer-2',
        role: 'chatbot',
        content:
          'I morgen leser jeg hjemme. “Leser” stays second after “I morgen”.',
      },
    ],
    followUpPrompts: [
      'Show me one more example',
      'Test me on the V2 rule',
      'Explain the first position',
    ],
  },
};

export const MarkdownLikeAnswer: Story = {
  args: {
    context: lessonContext,
    messages: [
      {
        id: 'question-v2',
        role: 'user',
        content: 'Explain the V2 rule in Norwegian.',
      },
      {
        id: 'answer-v2',
        role: 'chatbot',
        content:
          '**V2-regelen** betyr at det finitte verbet kommer på plass nummer to i en hovedsetning.\n\n#### Mini-regel\n\n> Det første leddet kan være tid, sted eller subjekt. Verbet blir likevel nummer to.\n\n---\n\nEksempler:\n\n- I dag **leser** jeg hjemme.\n- Nå **forstår** du regelen.\n- På mandag **drar** vi til Bergen.\n\n![Word order sketch](/vite.svg)',
      },
    ],
    followUpPrompts: [
      'Show me another V2 example',
      'Quiz me on word order',
      'Explain subordinate clauses',
    ],
  },
};

export const MarkdownBrokenImage: Story = {
  args: {
    context: lessonContext,
    messages: [
      {
        id: 'question-broken-image',
        role: 'user',
        content: 'Show me a diagram of the V2 rule.',
      },
      {
        id: 'answer-broken-image',
        role: 'chatbot',
        content:
          'Her er en skisse av setningsstrukturen:\n\n![Word order sketch](/missing.png)',
      },
    ],
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

export const ScrolledConversation: Story = {
  args: {
    context: lessonContext,
    messages: longConversation,
  },
};

export const NarrowPanel: Story = {
  args: {
    context: selectionContext,
    messages: longConversation.slice(0, 4),
  },
  decorators: [
    (Story) => (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="h-[620px] w-[320px]">
          <Story />
        </div>
      </div>
    ),
  ],
};

export const Loading: Story = {
  args: {
    context: readingContext,
    isLoading: true,
  },
};

export const ErrorState: Story = {
  args: {
    context: lessonContext,
    error: 'The chatbot could not answer. Try again in a moment.',
    messages: [
      {
        id: 'failed-question',
        role: 'user',
        content: 'Can you explain the V2 rule in this sentence?',
      },
    ],
  },
};

export const FlytUnavailable: Story = {
  args: {
    context: lessonContext,
    unavailableModels: ['flyt'],
  },
};

export const ModelChoice: Story = {
  args: {
    context: lessonContext,
    defaultModel: 'flyt',
    messages: longConversation.slice(0, 2),
  },
};

export const EmbeddedCard: Story = {
  args: {
    surface: 'card',
    context: lessonContext,
  },
  decorators: [
    (Story) => (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 sm:p-8">
        <div className="h-[620px] w-full max-w-[420px]">
          <Story />
        </div>
      </div>
    ),
  ],
};

export const MobileLessonContext: Story = {
  args: {
    context: lessonContext,
    starterPrompts: ['Explain the V2 rule', 'Show me another example'],
  },
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  decorators: [
    (Story) => (
      <div className="h-[100dvh] w-full bg-background">
        <Story />
      </div>
    ),
  ],
};
