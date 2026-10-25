import { Badge, Button, Heading, Text } from '@flyt/ui';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';

import { ChatbotProvider } from '@/components/chatbot/ChatbotProvider';
import { LookupProvider } from '@/components/lookup/LookupProvider';
import { lexiconKeys } from '@/hooks/lexicon/queries';
import { StoryEndSection } from '@/pages/ReadingPage/StoryEndSection';
import { StoryReaderLayout } from '@/pages/ReadingPage/StoryReaderLayout';
import { createStoryRouter } from '@/test/router';
import type { ReadingLemmaDefinitionsResponse } from '@/types/api';

import { ReaderDefinitionPanel } from './ReaderDefinitionPanel';
import { ReaderLookupSheet } from './ReaderLookupSheet';
import { ReaderPagination } from './ReaderPagination';
import { LEXICON, STORY_PAGES } from './readerSampleStory';
import {
  getPageVocabulary,
  getReaderWords,
  type ReaderWord,
} from './readerVocabulary';
import { ReaderWordList } from './ReaderWordList';
import { ReaderWordLookup } from './ReaderWordLookup';
import { getCefrBadgeTone } from './readingDisplay';
import type { StoryParagraph } from './storyParagraphs';
import { StoryParagraphView } from './StoryParagraphView';
import { StoryWordStateLegend } from './StoryWordStateLegend';

const SAMPLE_TOTAL_PAGES = 12;
const SCROLL_LEAD = 180;

function ReaderProviders({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const router = useMemo(() => {
    Object.values(LEXICON).forEach(({ card, state }) => {
      const data: ReadingLemmaDefinitionsResponse = {
        lemma: {
          ...card,
          primary_translation: card.primary_translation ?? null,
        },
        definitions: card.definitions.map(
          ({ examples_json, ...definition }) => ({
            ...definition,
            translation_source: definition.translation_source ?? null,
            examples: examples_json ?? [],
            userState: state,
          }),
        ),
      };
      queryClient.setQueryDefaults(lexiconKeys.lemmaDefinitions(card.uuid), {
        staleTime: Infinity,
      });
      queryClient.setQueryData(lexiconKeys.lemmaDefinitions(card.uuid), data);
    });
    return createStoryRouter(
      <ChatbotProvider
        initialOpenState="closed"
        initialMessages={[
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
      >
        <LookupProvider>{children}</LookupProvider>
      </ChatbotProvider>,
      ['/reading/story/sample'],
      ['/reading', '/reading/story/$uuid'],
    );
  }, [children, queryClient]);
  return <RouterProvider router={router} />;
}

function SampleReader() {
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedWord, setSelectedWord] = useState<ReaderWord>();
  const [wordListOpen, setWordListOpen] = useState(false);
  const [finished, setFinished] = useState(false);
  const returnFocusRef = useRef<HTMLElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const paragraphs = STORY_PAGES[pageIndex % STORY_PAGES.length];
  const parts: StoryParagraph[] = paragraphs.map((text) =>
    text.split(/(\p{L}+)/u).map((text) => ({
      text,
      isToken: Boolean(LEXICON[text.toLowerCase()]),
      lemmaUuid: LEXICON[text.toLowerCase()]?.card.uuid ?? null,
      state: LEXICON[text.toLowerCase()]?.state ?? 'mastered',
    })),
  );
  const readerWords = getReaderWords(parts);
  const vocabulary = getPageVocabulary(readerWords);

  useEffect(() => {
    articleRef.current?.closest('main')?.scrollTo({ top: 0 });
  }, [pageIndex]);
  const closeLookup = () => {
    setSelectedWord(undefined);
    setWordListOpen(false);
  };
  const selectWord = (word: ReaderWord) => {
    if (!wordListOpen && document.activeElement instanceof HTMLElement)
      returnFocusRef.current = document.activeElement;
    setSelectedWord(word);
  };
  const changePage = (page: number) => {
    closeLookup();
    setPageIndex(page - 1);
    articleRef.current?.focus({ preventScroll: true });
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-neutral text-default">
      <StoryReaderLayout
        title="Dracula"
        page={pageIndex + 1}
        totalPages={SAMPLE_TOTAL_PAGES}
        finished={finished}
        rail={
          !finished && (
            <ReaderDefinitionPanel
              words={vocabulary}
              selectedWord={selectedWord}
              onSelect={selectWord}
              onClose={closeLookup}
            />
          )
        }
        footer={
          !finished && (
            <ReaderPagination
              requestedPage={pageIndex + 1}
              settledPage={pageIndex + 1}
              totalPages={SAMPLE_TOTAL_PAGES}
              onPageChange={changePage}
              onFinish={() => setFinished(true)}
            />
          )
        }
      >
        <article
          ref={articleRef}
          tabIndex={-1}
          className="mx-auto w-full max-w-prose space-y-5 outline-none"
        >
          {finished ? (
            <StoryEndSection
              story={{
                title: 'Dracula',
                cefrLevel: 'B2',
                groupKey: 'gothic',
                groupTitle: 'Gotisk roman',
                totalPages: SAMPLE_TOTAL_PAGES,
                readingMinutes: 12,
              }}
              recommendations={[]}
              lookups={[]}
              continuation={{ kind: 'none' }}
              otherThemes={[]}
              onLookup={() => {}}
              onAddWords={async () => ({ added: [], failed: [] })}
            />
          ) : (
            <>
              <div className="sr-only space-y-2 lg:not-sr-only">
                <div className="flex flex-wrap items-center gap-2">
                  <Text as="span" size="medium" tone="subtle">
                    Gotisk roman
                  </Text>
                  <Badge tone={getCefrBadgeTone('B1')}>B1</Badge>
                </div>
                <Heading as="h1" size="xlarge">
                  Dracula
                </Heading>
              </div>
              <div className="flex items-center justify-between gap-3">
                <StoryWordStateLegend
                  counts={{
                    new: vocabulary.filter((word) => word.state === 'new')
                      .length,
                    learning: vocabulary.filter(
                      (word) => word.state === 'learning',
                    ).length,
                  }}
                />
                <div className="lg:hidden">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-haspopup="dialog"
                    onClick={() => {
                      if (document.activeElement instanceof HTMLElement)
                        returnFocusRef.current = document.activeElement;
                      setWordListOpen(true);
                    }}
                  >
                    Word list
                  </Button>
                </div>
              </div>
              <Text as="div" size="fluid" lang="nb">
                <div className="space-y-5">
                  {parts.map((paragraph, paragraphIndex) => (
                    <StoryParagraphView
                      key={paragraphIndex}
                      paragraph={paragraph}
                      paragraphIndex={paragraphIndex}
                      currentWordKey={selectedWord?.key}
                      onOpenLemma={(_uuid, _text, key) => {
                        const word = readerWords.find(
                          (word) => word.key === key,
                        );
                        if (word) selectWord(word);
                      }}
                    />
                  ))}
                </div>
              </Text>
            </>
          )}
        </article>
      </StoryReaderLayout>
      <ReaderLookupSheet
        open={wordListOpen || selectedWord !== undefined}
        title={selectedWord?.text ?? 'Words on this page'}
        onClose={closeLookup}
        returnFocusRef={returnFocusRef}
      >
        {selectedWord ? (
          <ReaderWordLookup word={selectedWord} onClose={closeLookup} />
        ) : (
          <ReaderWordList words={vocabulary} onSelect={selectWord} />
        )}
      </ReaderLookupSheet>
    </div>
  );
}

async function expectPageAnnounced(
  canvas: ReturnType<typeof within>,
  page: number,
) {
  await waitFor(() =>
    expect(
      canvas.getByRole('status', { name: 'Current story page' }),
    ).toHaveTextContent(`Page ${page} of ${SAMPLE_TOTAL_PAGES}`),
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
  const target = Array.from(scroller.querySelectorAll('button')).find(
    (button) => button.textContent?.toLowerCase() === word,
  );
  if (!target) throw new Error(`No interactive word "${word}" on this page`);
  scroller.scrollTop = Math.max(0, target.offsetTop - SCROLL_LEAD);
  return { scroller, target };
}
function expectNoHorizontalOverflow(canvasElement: HTMLElement) {
  const root = canvasElement.firstElementChild;
  if (!(root instanceof HTMLElement)) throw new Error('Reader root not found');
  expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
}

const meta = {
  title: 'Features/Reading/Reader pagination',
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
  decorators: [
    (Story) => (
      <ReaderProviders>
        <Story />
      </ReaderProviders>
    ),
  ],
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
    await expect(await canvas.findByTestId('definition-panel')).toBeVisible();
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
    await expect(await canvas.findByTestId('definition-panel')).toBeVisible();
    await expect(scroller.scrollTop).toBe(scrollBefore);
    await userEvent.click(canvas.getByRole('button', { name: 'Next page' }));
    await expectPageAnnounced(canvas, 2);
    await waitFor(() => expect(scroller.scrollTop).toBe(0));
    await expect(
      canvas.queryByTestId('definition-panel'),
    ).not.toBeInTheDocument();
    expectNoHorizontalOverflow(canvasElement);
  },
};
export const NumberPaginationFlow: Story = {
  name: 'Sequential pagination flow',
  globals: { viewport: { value: 'desktop1440' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.queryByRole('button', { name: 'Previous page' }),
    ).not.toBeInTheDocument();
    for (let page = 2; page <= SAMPLE_TOTAL_PAGES; page++) {
      await userEvent.click(canvas.getByRole('button', { name: 'Next page' }));
      await expectPageAnnounced(canvas, page);
    }
    await userEvent.click(
      canvas.getByRole('button', { name: 'Previous page' }),
    );
    await expectPageAnnounced(canvas, SAMPLE_TOTAL_PAGES - 1);
    await userEvent.click(canvas.getByRole('button', { name: 'Next page' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Finish story' }));
    await expect(
      canvas.getByRole('heading', { name: 'Story finished' }),
    ).toBeVisible();
    await expect(
      canvas.queryByRole('navigation', { name: 'Story pages' }),
    ).not.toBeInTheDocument();
  },
};
export const AskFlytOpen: Story = {
  globals: { viewport: { value: 'desktop1440' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Ask Flyt' });
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() =>
      expect(
        canvas.getByRole('complementary', { name: 'Ask Flyt chatbot' }),
      ).toBeVisible(),
    );
    await expect(
      canvas.getByText(/Mørket, ulvene og den stille kusken/),
    ).toBeVisible();
    expectNoHorizontalOverflow(canvasElement);
  },
};
export const MobilePagination: Story = {
  globals: { viewport: { value: 'mobile390' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const scroller = getScroller(canvasElement);
    scroller.scrollTop = scroller.scrollHeight;
    await expect(
      canvas.getByRole('button', { name: 'Next page' }),
    ).toBeVisible();
    await expect(
      canvas.queryByRole('button', { name: 'Previous page' }),
    ).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Next page' }));
    await expectPageAnnounced(canvas, 2);
    expectNoHorizontalOverflow(canvasElement);
  },
};
export const MobileAskFlytOpen: Story = {
  globals: { viewport: { value: 'mobile390' } },
  play: async () => {
    const body = within(document.body);
    await userEvent.click(body.getByRole('button', { name: 'Ask Flyt' }));
    const panel = window.matchMedia('(min-width: 1024px)').matches
      ? body.getByRole('complementary', { name: 'Ask Flyt chatbot' })
      : body.getByRole('dialog', { name: 'Ask Flyt' });
    await waitFor(() => expect(panel).toBeVisible());
    await expect(
      body.getByRole('button', { name: 'Close chatbot' }),
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
    await waitFor(() =>
      expect(
        canvas.getByRole('complementary', { name: 'Ask Flyt chatbot' }),
      ).toBeVisible(),
    );
    await expect(
      canvas.getByRole('button', { name: 'Next page' }),
    ).toBeVisible();
    await waitFor(() => expectNoHorizontalOverflow(canvasElement));
  },
};
