import { LemmaCardView } from '@flyt/lexicon';
import type { Meta, StoryObj } from '@storybook/react';
import { Search, Sparkles } from 'lucide-react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { useEffect, useRef, useState } from 'react';

import { FlytChatbotPanel } from '@/components/chatbot/FlytChatbotPanel';
import { getCefrBadgeClassName } from '@/components/reading/readingDisplay';
import { StoryWordStateLegend } from '@/components/reading/StoryWordStateLegend';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { ReaderPagination } from './ReaderPagination';
import type { WordEntry } from './readerSampleStory';
import { LEXICON, STORY_PAGES } from './readerSampleStory';

const SCROLL_LEAD = 180;
const SAMPLE_TOTAL_PAGES = 12;

function countWords(paragraphs: string[]): number {
  return paragraphs.join(' ').split(/\s+/).filter(Boolean).length;
}

type Anchor = {
  word: string;
  entry: WordEntry;
};

function SampleReaderHeader({
  chatbotOpen,
  onAskFlyt,
}: {
  chatbotOpen: boolean;
  onAskFlyt?: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 shrink-0 border-b border-border/60 bg-white-100 px-4 py-3 lg:px-6">
      <div className="mx-auto flex w-full max-w-[92rem] items-center justify-between gap-3">
        <span className="type-caption text-muted-foreground">&larr; Back</span>
        <button
          type="button"
          aria-label="Search the dictionary"
          className="hidden h-11 w-11 items-center justify-center rounded-full text-secondary-60 transition-colors hover:bg-secondary-10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:inline-flex"
        >
          <Search className="icon-sm" />
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onAskFlyt}
            aria-label="Ask Flyt"
            aria-controls="sample-flyt-chatbot"
            aria-expanded={chatbotOpen}
            className={cn(
              'inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-3 type-caption font-semibold text-primary-90 transition-colors hover:bg-primary-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:px-4',
              chatbotOpen
                ? 'border-primary-50 bg-primary-20'
                : 'border-primary-30 bg-primary-10',
            )}
          >
            <Sparkles className="icon-sm" strokeWidth={2.1} />
            Ask Flyt
          </button>
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-full bg-secondary-20 type-caption-sm font-semibold text-secondary-90"
          >
            A
          </span>
        </div>
      </div>
    </header>
  );
}

function ProseParagraph({
  text,
  paragraphIndex,
  openWord,
  onOpenWord,
}: {
  text: string;
  paragraphIndex: number;
  openWord: string | null;
  onOpenWord: (anchor: Anchor) => void;
}) {
  return (
    <p className="whitespace-pre-wrap">
      {text.split(/(\p{L}+)/u).map((part, partIndex) => {
        const entry = LEXICON[part.toLowerCase()];
        const key = `p${paragraphIndex}-${partIndex}-${part}`;
        if (!entry) {
          return <span key={key}>{part}</span>;
        }

        const surface = part.toLowerCase();
        return (
          <button
            key={key}
            type="button"
            data-word={surface}
            data-testid="reader-word"
            aria-expanded={openWord === surface}
            className={cn(
              'inline cursor-pointer rounded border-0 bg-transparent p-0 px-0.5 font-inherit text-left text-inherit transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              entry.state === 'new'
                ? 'word-underline-new hover:opacity-80'
                : 'word-underline-learning hover:opacity-80',
            )}
            onClick={() =>
              onOpenWord({
                word: surface,
                entry,
              })
            }
          >
            {part}
          </button>
        );
      })}
    </p>
  );
}

function ReaderDefinitionRail({ anchor }: { anchor: Anchor | null }) {
  return (
    <aside
      aria-label="Dictionary definition"
      className="hidden w-80 shrink-0 overflow-y-auto border-l border-border bg-card lg:block"
    >
      {anchor ? (
        <div className="px-5 py-4" data-testid="definition-panel">
          <LemmaCardView
            lemma={anchor.entry.card}
            state={anchor.entry.state}
            className="space-y-4"
            headingClassName="font-display type-hero text-secondary-90"
            knowLabel="I already know this"
            addLabel="Add to review"
            behavior={{
              showStateLabels: false,
              disableKnowWhenLearning: false,
              disableAddWhenMastered: false,
            }}
            onMarkKnown={() => {}}
            onAddToReview={() => {}}
          />
        </div>
      ) : (
        <div className="flex h-full items-center justify-center px-5 py-8 text-center type-caption text-muted-foreground italic">
          Tap a word to look it up
        </div>
      )}
    </aside>
  );
}

function SampleReader({ onAskFlyt }: { onAskFlyt?: () => void }) {
  const [pageIndex, setPageIndex] = useState(0);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [chatbotOpen, setChatbotOpen] = useState(false);
  const scrollRef = useRef<HTMLElement>(null);

  const paragraphs = STORY_PAGES[pageIndex % STORY_PAGES.length];
  const totalPages = SAMPLE_TOTAL_PAGES;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [pageIndex]);

  const toggleChatbot = () => {
    setChatbotOpen((open) => !open);
    onAskFlyt?.();
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <SampleReaderHeader chatbotOpen={chatbotOpen} onAskFlyt={toggleChatbot} />

      <div
        className={cn(
          'grid min-h-0 flex-1 items-stretch transition-[grid-template-columns] duration-300',
          chatbotOpen
            ? 'grid-cols-1 lg:grid-cols-[minmax(0,1fr)_28rem]'
            : 'grid-cols-1 lg:grid-cols-[minmax(0,1fr)_0rem]',
        )}
      >
        <div className="flex min-h-0 min-w-0">
          <main
            ref={scrollRef}
            data-testid="reader-scroll"
            className="relative z-10 min-h-0 min-w-0 flex-1 overflow-y-auto"
          >
            <div className="mx-auto w-full max-w-[46rem] px-6 pb-16 pt-10">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="type-caption text-muted-foreground">
                    Gotisk roman
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'type-caption-sm font-semibold',
                      getCefrBadgeClassName('B1'),
                    )}
                  >
                    B1
                  </Badge>
                  <span aria-hidden="true" className="text-secondary-40">
                    &middot;
                  </span>
                  <span className="type-caption text-muted-foreground">
                    {countWords(paragraphs)} ord på denne siden
                  </span>
                </div>
                <h1 className="type-hero font-display">Dracula</h1>
              </div>

              <div className="mt-8 space-y-4 type-section leading-9 text-foreground">
                {paragraphs.map((text, paragraphIndex) => (
                  <ProseParagraph
                    key={`page-${pageIndex}-paragraph-${paragraphIndex}`}
                    text={text}
                    paragraphIndex={paragraphIndex}
                    openWord={anchor?.word ?? null}
                    onOpenWord={setAnchor}
                  />
                ))}
              </div>

              <StoryWordStateLegend className="mt-8 border-t border-border pt-4" />

              <ReaderPagination
                requestedPage={pageIndex + 1}
                settledPage={pageIndex + 1}
                totalPages={totalPages}
                onPageChange={(page) => setPageIndex(page - 1)}
              />
            </div>
          </main>
          <ReaderDefinitionRail anchor={anchor} />
        </div>

        <aside
          id="sample-flyt-chatbot"
          aria-label="Ask Flyt chatbot"
          className={cn(
            'min-h-0 min-w-0 overflow-hidden bg-card',
            chatbotOpen
              ? 'fixed inset-0 z-50 flex lg:static lg:border-l lg:border-border/70'
              : 'hidden lg:block',
          )}
          inert={!chatbotOpen}
        >
          <FlytChatbotPanel
            surface="pane"
            context={{
              kind: 'reading',
              label: 'Dracula',
              detail: `Page ${pageIndex + 1} of ${totalPages}`,
            }}
            messages={[
              {
                id: 'reader-question',
                role: 'user',
                content: 'Hvorfor er stemningen så urolig her?',
              },
              {
                id: 'reader-answer',
                role: 'chatbot',
                content:
                  'Mørket, ulvene og den stille kusken gjør reisen utrygg. Fortelleren prøver å være rasjonell, men detaljene viser at han er redd.',
              },
            ]}
            followUpPrompts={[
              'Forklar avsnittet enklere',
              'Hvilke ord skaper spenning?',
            ]}
            onClose={() => setChatbotOpen(false)}
            onSend={() => {}}
          />
        </aside>
      </div>
    </div>
  );
}

async function expectPageAnnounced(
  canvas: ReturnType<typeof within>,
  page: number,
) {
  await waitFor(() =>
    expect(
      canvas.getByText(`Page ${page} of ${SAMPLE_TOTAL_PAGES}`),
    ).toBeInTheDocument(),
  );
}

function getScroller(canvasElement: HTMLElement): HTMLElement {
  const scroller = canvasElement.querySelector<HTMLElement>(
    '[data-testid="reader-scroll"]',
  );
  if (!scroller) throw new Error('Reader scroll container not found');
  return scroller;
}

function scrollWordIntoReading(canvasElement: HTMLElement, word: string) {
  const scroller = getScroller(canvasElement);
  const target = canvasElement.querySelector<HTMLButtonElement>(
    `[data-word="${word}"]`,
  );
  if (!target) throw new Error(`No interactive word "${word}" on this page`);
  scroller.scrollTop = Math.max(0, target.offsetTop - SCROLL_LEAD);
  return { scroller, target };
}

function expectNoHorizontalOverflow(canvasElement: HTMLElement) {
  const root = canvasElement.firstElementChild as HTMLElement;
  expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
}

const meta = {
  title: 'Reading/Reader pagination',
  component: SampleReader,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    viewport: {
      options: {
        mobile390: {
          name: 'Mobile 390',
          styles: { width: '390px', height: '844px' },
          type: 'mobile',
        },
        desktop1024: {
          name: 'Desktop 1024',
          styles: { width: '1024px', height: '900px' },
          type: 'desktop',
        },
        desktop1280: {
          name: 'Desktop 1280',
          styles: { width: '1280px', height: '900px' },
          type: 'desktop',
        },
        desktop1440: {
          name: 'Desktop 1440',
          styles: { width: '1440px', height: '900px' },
          type: 'desktop',
        },
      },
    },
  },
  args: { onAskFlyt: fn() },
} satisfies Meta<typeof SampleReader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PaginatedReader: Story = {
  globals: { viewport: { value: 'desktop1440' } },
};

export const DefinitionOpenAfterScroll: Story = {
  globals: { viewport: { value: 'desktop1440' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const { scroller, target } = scrollWordIntoReading(canvasElement, 'ulvene');
    const scrollBefore = scroller.scrollTop;

    await userEvent.click(target);

    const panel = await canvas.findByTestId('definition-panel');
    await expect(panel).toBeVisible();
    await expect(scroller.scrollTop).toBe(scrollBefore);
  },
};

export const DefinitionRailAndPaginationFlow: Story = {
  globals: { viewport: { value: 'desktop1440' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const { scroller, target } = scrollWordIntoReading(canvasElement, 'ulvene');
    const scrollBefore = scroller.scrollTop;
    await expect(scrollBefore).toBeGreaterThan(0);

    await userEvent.click(target);
    const panel = await canvas.findByTestId('definition-panel');
    await expect(panel).toBeVisible();
    await expect(scroller.scrollTop).toBe(scrollBefore);
    expectNoHorizontalOverflow(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Next page' }));
    await expectPageAnnounced(canvas, 2);
    await waitFor(() => expect(scroller.scrollTop).toBe(0));
    await waitFor(() => expectNoHorizontalOverflow(canvasElement));
  },
};

export const NumberPaginationFlow: Story = {
  globals: { viewport: { value: 'desktop1440' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Page 5' }));
    await expectPageAnnounced(canvas, 5);
    await expect(
      canvas.getByRole('button', { name: 'Page 5' }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(canvas.getByRole('button', { name: 'Page 6' })).toBeVisible();

    await userEvent.click(
      canvas.getByRole('button', { name: 'Jump forward 3 pages' }),
    );
    await expectPageAnnounced(canvas, 8);

    await userEvent.click(canvas.getByRole('button', { name: 'Last page' }));
    await expectPageAnnounced(canvas, 12);
    await expect(
      canvas.getByRole('button', { name: 'Last page' }),
    ).toBeDisabled();

    await userEvent.click(canvas.getByRole('button', { name: 'First page' }));
    await expectPageAnnounced(canvas, 1);
  },
};

export const AskFlytOpen: Story = {
  globals: { viewport: { value: 'desktop1440' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Ask Flyt' });
    await userEvent.click(trigger);

    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(
      canvas.getByRole('complementary', { name: 'Ask Flyt chatbot' }),
    ).toBeVisible();
    await expect(
      canvas.getByText(/Mørket, ulvene og den stille kusken/),
    ).toBeVisible();
    await waitFor(() => expectNoHorizontalOverflow(canvasElement));
  },
};

export const MobilePagination: Story = {
  globals: { viewport: { value: 'mobile390' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const scroller = getScroller(canvasElement);
    scroller.scrollTop = scroller.scrollHeight;

    await expect(
      canvas.getByRole('button', { name: 'First page' }),
    ).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'Next page' }),
    ).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Page 12' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Page 5' }));
    await expectPageAnnounced(canvas, 5);
    expectNoHorizontalOverflow(canvasElement);
  },
};

export const MobileAskFlytOpen: Story = {
  globals: { viewport: { value: 'mobile390' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Ask Flyt' }));

    const panel = canvas.getByRole('complementary', {
      name: 'Ask Flyt chatbot',
    });
    await expect(panel).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'Close chatbot' }),
    ).toBeVisible();
  },
};

export const NarrowDesktop1024: Story = {
  globals: { viewport: { value: 'desktop1024' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const { target } = scrollWordIntoReading(canvasElement, 'slottet');
    await userEvent.click(target);
    await canvas.findByTestId('definition-panel');
    expectNoHorizontalOverflow(canvasElement);
  },
};

export const Desktop1280: Story = {
  globals: { viewport: { value: 'desktop1280' } },
  play: async ({ canvasElement }) => {
    expectNoHorizontalOverflow(canvasElement);
  },
};

export const NarrowDesktopWithAskFlyt: Story = {
  globals: { viewport: { value: 'desktop1024' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Ask Flyt' }));

    await expect(
      canvas.getByRole('complementary', { name: 'Ask Flyt chatbot' }),
    ).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Page 1' })).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'Last page' }),
    ).toBeVisible();
    await waitFor(() => expectNoHorizontalOverflow(canvasElement));
  },
};
