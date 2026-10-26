import { Badge, Button, Heading, Text } from '@flyt/ui';
import { Check } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';

import {
  useChatbot,
  useChatbotPageContext,
} from '@/components/chatbot/ChatbotProvider';
import { LookupSheet } from '@/components/lookup/LookupSheet';
import { useLookupContext } from '@/components/lookup/useLookupContext';
import { ReaderDefinitionPanel } from '@/components/reading/ReaderDefinitionPanel';
import { ReaderLookupSheet } from '@/components/reading/ReaderLookupSheet';
import { ReaderPagination } from '@/components/reading/ReaderPagination';
import {
  getPageVocabulary,
  getReaderWords,
  type ReaderWord,
} from '@/components/reading/readerVocabulary';
import {
  EasierStoryNotice,
  ReaderWordList,
} from '@/components/reading/ReaderWordList';
import { ReaderWordLookup } from '@/components/reading/ReaderWordLookup';
import { getCefrBadgeTone } from '@/components/reading/readingDisplay';
import { buildStoryParagraphs } from '@/components/reading/storyParagraphs';
import { StoryParagraphView } from '@/components/reading/StoryParagraphView';
import { StoryWordStateLegend } from '@/components/reading/StoryWordStateLegend';
import {
  usePrefetchAdjacentStoryPages,
  useReadingStory,
  useReadingStoryRecommendations,
  useSaveReadingProgress,
} from '@/hooks/reading/queries';
import { useIsDesktop } from '@/hooks/ui/useIsDesktop';
import { getApiErrorCode } from '@/lib/apiError';
import { cn } from '@/lib/utils';
import {
  IMPORT_ERROR_CODES,
  type ReadingStoryPageResponse,
  type ReadingStorySummary,
} from '@/types/api';

import { mergeStoryLookup, type StoryLookupWord } from './storyCompletion';
import { StoryProcessingNotice } from './StoryProcessingNotice';
import { StoryReaderCompletion } from './StoryReaderCompletion';
import { StoryReaderError } from './StoryReaderError';
import { StoryReaderLayout } from './StoryReaderLayout';
import {
  StoryReaderFooterSkeleton,
  StoryReaderLoading,
} from './StoryReaderLoading';
import { useReaderPageTransition } from './useReaderPageTransition';
import { useReadingProgressAutosave } from './useReadingProgressAutosave';
import { useStoryLookups } from './useStoryLookups';

const STORY_TITLE_ID = 'story-reader-title';

export interface StoryReaderPageProps {
  page?: number;
  onPageChange: (page: number) => void;
  onResolvedPage?: (page: number, data: ReadingStoryPageResponse) => void;
  storyUuid: string;
}

export function StoryReaderPage(props: StoryReaderPageProps) {
  return <StoryReaderSession key={props.storyUuid} {...props} />;
}

function StoryReaderSession({
  page,
  onPageChange,
  onResolvedPage,
  storyUuid,
}: StoryReaderPageProps) {
  const requestedIndex = page === undefined ? undefined : page - 1;
  const [finishView, setFinishView] = useState<{
    page: number | undefined;
    index?: number;
  }>({ page });
  if (finishView.page !== page) setFinishView({ page });
  const completionOpen =
    finishView.page === page && finishView.index !== undefined;
  const {
    data,
    dataUpdatedAt,
    error,
    isError,
    isPending,
    isPlaceholderData,
    refetch,
  } = useReadingStory(storyUuid, requestedIndex, { enabled: !completionOpen });
  const recommendationsQuery = useReadingStoryRecommendations(storyUuid);
  const finishMutation = useSaveReadingProgress(storyUuid);
  const settled = isPlaceholderData ? undefined : data;
  const isSettledLastPage =
    settled !== undefined && settled.page.index >= settled.totalPages - 1;
  const finished =
    isSettledLastPage && finishView.index === settled?.page.index;

  useEffect(() => {
    if (page === undefined || isError || isPlaceholderData || !data) return;
    const resolvedPage = data.page.index + 1;
    if (resolvedPage !== page) onResolvedPage?.(resolvedPage, data);
  }, [data, isError, isPlaceholderData, onResolvedPage, page]);

  useReadingProgressAutosave({
    data: isSettledLastPage ? undefined : settled,
    isLastPage: isSettledLastPage,
    page: requestedIndex,
    storyUuid,
  });
  usePrefetchAdjacentStoryPages(
    storyUuid,
    settled?.page.index,
    settled?.totalPages,
  );
  useChatbotPageContext(
    settled
      ? {
          kind: 'reading',
          label: settled.title,
          detail: finished
            ? 'Story finished'
            : `Page ${settled.page.index + 1} of ${settled.totalPages}`,
        }
      : null,
  );

  const reader = useReaderLookup(data, dataUpdatedAt);
  const articleRef = useReaderPageTransition(
    settled?.page.index,
    finished,
    reader.closeForPageTransition,
  );
  const finishStory = () => {
    if (!settled || !isSettledLastPage || finishMutation.isPending) return;
    if (settled.completed) {
      setFinishView({ page, index: settled.page.index });
      return;
    }
    finishMutation.mutate(settled.page.index, {
      onSuccess: () =>
        setFinishView((current) =>
          current === finishView
            ? { ...current, index: settled.page.index }
            : current,
        ),
    });
  };

  if (isError || !data)
    return (
      <StoryReaderRequestState
        pending={isPending}
        error={error}
        onRetry={() => void refetch()}
      />
    );

  return (
    <StoryReaderContent
      data={data}
      reader={reader}
      articleRef={articleRef}
      requestedPage={Math.min(page ?? data.page.index + 1, data.totalPages)}
      settledPage={settled && settled.page.index + 1}
      isPlaceholderData={isPlaceholderData}
      finished={finished}
      finishing={finishMutation.isPending}
      onFinish={finishStory}
      onPageChange={onPageChange}
      recommendations={recommendationsQuery.data?.stories ?? []}
    />
  );
}

function StoryReaderRequestState({
  pending,
  error,
  onRetry,
}: {
  pending: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  if (pending)
    return (
      <StoryReaderLayout loading footer={<StoryReaderFooterSkeleton />}>
        <StoryReaderLoading />
        <LookupSheet readerOwnsLemma />
      </StoryReaderLayout>
    );
  if (getApiErrorCode(error) === IMPORT_ERROR_CODES.NOT_READY)
    return (
      <StoryReaderLayout>
        <StoryProcessingNotice />
        <LookupSheet readerOwnsLemma />
      </StoryReaderLayout>
    );
  return <StoryReaderError onRetry={onRetry} />;
}

function useReaderLookup(
  data: ReadingStoryPageResponse | undefined,
  dataUpdatedAt: number,
) {
  const { close, openLemma, isOpen, mode, lemmaTarget } = useLookupContext();
  const { close: closeChatbot } = useChatbot();
  const isDesktop = useIsDesktop();
  const [selectedOccurrence, setSelectedOccurrence] = useState<ReaderWord>();
  const [wordListOpen, setWordListOpen] = useState(false);
  const [easierNoticeDismissed, setEasierNoticeDismissed] = useState(false);
  const [taps, setTaps] = useState<readonly StoryLookupWord[]>([]);
  const lookups = useStoryLookups(taps);
  const returnFocusRef = useRef<HTMLElement>(null);
  const closeLookup = useCallback(() => {
    close();
    setWordListOpen(false);
  }, [close]);
  const closeForPageTransition = useCallback(
    (article: HTMLElement | null) => {
      returnFocusRef.current = article;
      closeLookup();
    },
    [closeLookup],
  );
  const paragraphs = useMemo(
    () => (data ? buildStoryParagraphs(data.page, data.userStates) : []),
    [data],
  );
  const words = useMemo(() => getReaderWords(paragraphs), [paragraphs]);
  const vocabulary = useMemo(() => getPageVocabulary(words), [words]);
  const newCount = vocabulary.filter((word) => word.state === 'new').length;
  const learningCount = vocabulary.filter(
    (word) => word.state === 'learning',
  ).length;
  const allMastered =
    words.length > 0 &&
    words.every((word) => word.lemmaUuid !== null && word.state === 'mastered');
  const pageNewCount = words.filter((word) => word.state === 'new').length;
  const offerEasierStory =
    pageNewCount >= 12 && pageNewCount / words.length >= 0.4;
  const target = isOpen && mode === 'lemma' ? lemmaTarget : null;
  const selectedWord = target
    ? selectedOccurrence?.lemmaUuid === target.lemmaUuid &&
      selectedOccurrence.text === target.wordText
      ? selectedOccurrence
      : findReaderWord(words, undefined, target, lookups)
    : undefined;
  const rememberFocus = () => {
    if (document.activeElement instanceof HTMLElement)
      returnFocusRef.current = document.activeElement;
  };
  const selectListWord = useCallback(
    (word: ReaderWord) => {
      if (!wordListOpen && document.activeElement instanceof HTMLElement)
        returnFocusRef.current = document.activeElement;
      setSelectedOccurrence(word);
      setTaps((current) => {
        const prior = current.find(
          (lookup) =>
            lookup.lemmaUuid === word.lemmaUuid &&
            (word.lemmaUuid !== null || lookup.text === word.text),
        );
        return mergeStoryLookup(current, {
          ...word,
          dictionaryForm: prior?.dictionaryForm ?? word.text,
          observedAt: dataUpdatedAt,
        });
      });
      if (isDesktop) closeChatbot();
      openLemma(word.lemmaUuid, word.text);
    },
    [closeChatbot, dataUpdatedAt, isDesktop, openLemma, wordListOpen],
  );
  const selectWord = useCallback(
    (lemmaUuid: string | null, text: string, wordKey: string) =>
      selectListWord(
        findReaderWord(words, wordKey, { lemmaUuid, wordText: text }),
      ),
    [selectListWord, words],
  );
  const backToWords = () => {
    close();
    returnFocusRef.current?.focus();
  };
  const openWordList = () => {
    rememberFocus();
    setWordListOpen(true);
  };
  return {
    lookups,
    closeLookup,
    closeForPageTransition,
    paragraphs,
    vocabulary,
    selectedWord,
    selectWord,
    selectListWord,
    backToWords,
    wordListOpen,
    openWordList,
    returnFocusRef,
    newCount,
    learningCount,
    allMastered,
    pageNewCount,
    offerEasierStory,
    easierNoticeDismissed,
    dismissEasierNotice: () => setEasierNoticeDismissed(true),
  };
}

function findReaderWord(
  words: readonly ReaderWord[],
  selectedKey: string | undefined,
  target: { lemmaUuid: string | null; wordText: string },
  lookups: readonly StoryLookupWord[] = [],
): ReaderWord {
  const matches = words.filter(
    (word) =>
      word.lemmaUuid === target.lemmaUuid && word.text === target.wordText,
  );
  return (
    matches.find((word) => word.key === selectedKey) ??
    matches[0] ??
    lookups.find(
      (word) =>
        word.lemmaUuid === target.lemmaUuid && word.text === target.wordText,
    ) ?? {
      key: '',
      text: target.wordText,
      lemmaUuid: target.lemmaUuid,
      state: 'new',
      sentence: '',
    }
  );
}

function StoryReaderContent({
  data,
  reader,
  articleRef,
  requestedPage,
  settledPage,
  isPlaceholderData,
  finished,
  finishing,
  onFinish,
  onPageChange,
  recommendations,
}: {
  data: ReadingStoryPageResponse;
  reader: ReturnType<typeof useReaderLookup>;
  articleRef: RefObject<HTMLElement | null>;
  requestedPage: number;
  settledPage: number | undefined;
  isPlaceholderData: boolean;
  finished: boolean;
  finishing: boolean;
  onFinish: () => void;
  onPageChange: (page: number) => void;
  recommendations: readonly ReadingStorySummary[];
}) {
  const {
    vocabulary,
    selectedWord,
    selectListWord,
    backToWords,
    wordListOpen,
    closeLookup,
    returnFocusRef,
    offerEasierStory,
    pageNewCount,
    easierNoticeDismissed,
    dismissEasierNotice,
  } = reader;
  const easierNotice =
    offerEasierStory && !easierNoticeDismissed ? (
      <EasierStoryNotice
        newCount={pageNewCount}
        story={data}
        onDismiss={dismissEasierNotice}
      />
    ) : undefined;

  return (
    <>
      <StoryReaderLayout
        title={data.title}
        page={requestedPage}
        totalPages={data.totalPages}
        finished={finished}
        rail={
          (!finished || selectedWord !== undefined) && (
            <ReaderDefinitionPanel
              key={data.page.index}
              words={vocabulary}
              selectedWord={selectedWord}
              onSelect={selectListWord}
              onClose={backToWords}
              wordListAvailable={!finished}
              easierStoryNotice={easierNotice}
            />
          )
        }
        footer={
          !finished && (
            <ReaderPagination
              requestedPage={requestedPage}
              settledPage={settledPage}
              totalPages={data.totalPages}
              onPageChange={onPageChange}
              onFinish={onFinish}
              finishing={finishing}
            />
          )
        }
      >
        <article
          aria-busy={isPlaceholderData}
          aria-labelledby={finished ? 'story-finished-title' : STORY_TITLE_ID}
          className={cn(
            'mx-auto w-full space-y-5 outline-none',
            finished ? 'max-w-5xl' : 'max-w-prose',
            isPlaceholderData && 'opacity-60',
          )}
          ref={articleRef}
          tabIndex={-1}
        >
          {finished ? (
            <StoryReaderCompletion
              story={data}
              recommendations={recommendations}
              lookups={reader.lookups}
              onLookup={reader.selectListWord}
            />
          ) : (
            <ReaderStoryText
              data={data}
              reader={reader}
              easierNotice={easierNotice}
            />
          )}
        </article>
      </StoryReaderLayout>
      <LookupSheet readerOwnsLemma />
      <ReaderLookupSheet
        open={wordListOpen || selectedWord !== undefined}
        title={selectedWord?.text ?? 'Words on this page'}
        onClose={closeLookup}
        returnFocusRef={returnFocusRef}
      >
        {selectedWord ? (
          <ReaderWordLookup
            key={selectedWord.lemmaUuid ?? selectedWord.text}
            word={selectedWord}
            onClose={closeLookup}
          />
        ) : (
          <ReaderWordList
            key={data.page.index}
            words={vocabulary}
            onSelect={selectListWord}
            easierStoryNotice={easierNotice}
          />
        )}
      </ReaderLookupSheet>
    </>
  );
}

function ReaderStoryText({
  data,
  reader,
  easierNotice,
}: {
  data: ReadingStoryPageResponse;
  reader: ReturnType<typeof useReaderLookup>;
  easierNotice: ReactNode;
}) {
  const {
    allMastered,
    newCount,
    learningCount,
    openWordList,
    paragraphs,
    selectedWord,
    selectWord,
  } = reader;
  return (
    <>
      <div className="sr-only space-y-2 lg:not-sr-only">
        <div className="flex flex-wrap items-center gap-2">
          {data.groupTitle && (
            <Text as="span" size="medium" tone="subtle">
              {data.groupTitle}
            </Text>
          )}
          {data.cefrLevel && (
            <Badge tone={getCefrBadgeTone(data.cefrLevel)}>
              {data.cefrLevel}
            </Badge>
          )}
        </div>
        <Heading as="h1" id={STORY_TITLE_ID} size="xlarge" lang="nb">
          {data.title}
        </Heading>
      </div>
      {easierNotice && <div className="lg:hidden">{easierNotice}</div>}
      <div className="flex items-center justify-between gap-3">
        {allMastered ? (
          <Text as="span" size="small" tone="success">
            <span className="flex items-center gap-2">
              <Check className="icon-sm" aria-hidden />
              You know every word on this page
            </span>
          </Text>
        ) : (
          <StoryWordStateLegend
            counts={{ new: newCount, learning: learningCount }}
          />
        )}
        {!allMastered && (newCount > 0 || learningCount > 0) && (
          <div className="lg:hidden">
            <Button
              variant="ghost"
              size="sm"
              aria-haspopup="dialog"
              onClick={openWordList}
            >
              Word list
            </Button>
          </div>
        )}
      </div>
      <Text as="div" size="fluid" lang="nb">
        <div className="space-y-5">
          {paragraphs.map((paragraph, paragraphIndex) => (
            <StoryParagraphView
              key={`paragraph-${paragraphIndex}`}
              paragraph={paragraph}
              paragraphIndex={paragraphIndex}
              currentWordKey={selectedWord?.key}
              onOpenLemma={selectWord}
            />
          ))}
        </div>
      </Text>
    </>
  );
}
