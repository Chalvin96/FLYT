import { Badge } from '@flyt/ui';
import { Clock3 } from 'lucide-react';
import { useMemo, useRef } from 'react';

import { AppCard } from '@/components/common/AppCard/AppCard';
import { Button } from '@/components/common/Button/Button';
import { ErrorMessage } from '@/components/common/ErrorMessage/ErrorMessage';
import { useLookupContext } from '@/components/lookup/useLookupContext';
import { buildStoryParagraphs } from '@/components/reading/storyParagraphs';
import { StoryParagraphView } from '@/components/reading/StoryParagraphView';
import { getApiErrorMessage } from '@/lib/apiError';
import type { StoryGenerationCurrentResponse } from '@/types/api';

export function GeneratedStory({
  current,
  onGenerateAnother,
  onImport,
  isGenerating,
  isImporting,
  importError,
}: {
  current: StoryGenerationCurrentResponse;
  onGenerateAnother: () => void;
  onImport: (title?: string) => void;
  isGenerating: boolean;
  isImporting: boolean;
  importError: unknown;
}) {
  const { openLemma } = useLookupContext();
  const articleRef = useRef<HTMLElement>(null);
  const pages = useMemo(() => current.pages ?? [], [current.pages]);
  const paragraphsByPage = useMemo(() => {
    const built = pages.map((page) => ({
      page,
      paragraphs: buildStoryParagraphs(
        { content: page.content, tokens: page.tokens },
        current.userStates ?? {},
      ),
    }));
    return built.map((entry, index) => ({
      ...entry,
      start: built
        .slice(0, index)
        .reduce((total, prior) => total + prior.paragraphs.length, 0),
    }));
  }, [pages, current.userStates]);

  function handleReadStory() {
    const article = articleRef.current;
    if (!article) return;
    article.focus({ preventScroll: true });
    article.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  return (
    <AppCard
      className="flex flex-col p-0 xl:max-h-[calc(100dvh-16rem)] xl:overflow-hidden"
      data-testid="generated-story"
    >
      <div className="p-5 pb-4 sm:p-6 sm:pb-4">
        <div className="space-y-1">
          <Badge variant="secondary" className="bg-primary-10 text-primary-90">
            Ready to read
          </Badge>
          <h2 className="type-title font-display text-foreground">
            {current.topic || 'Your generated story'}
          </h2>
          <p className="type-caption text-muted-foreground">
            About {current.length} words · {pages.length}{' '}
            {pages.length === 1 ? 'page' : 'pages'}
          </p>
        </div>
      </div>

      <div
        className="sticky top-0 z-10 border-y border-border bg-card px-5 py-3 sm:px-6 xl:static xl:z-auto xl:border-y-0 xl:px-0 xl:py-0"
        data-testid="generated-story-actions"
      >
        <div className="flex flex-wrap items-center gap-2 xl:border-b xl:border-border xl:pb-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleReadStory}
            disabled={pages.length === 0}
          >
            Read story
          </Button>
          <Button
            type="button"
            disabled={isImporting || pages.length === 0}
            onClick={() => onImport()}
          >
            {isImporting ? 'Importing…' : 'Import to library'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onGenerateAnother}
            aria-describedby="generated-story-warning"
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating…' : 'Generate another'}
          </Button>
        </div>
        <div
          className="mt-3 flex items-start gap-3 radius-field bg-warning-10 px-3 py-3 type-caption text-warning-90"
          id="generated-story-warning"
        >
          <Clock3 className="mt-0.5 icon-sm shrink-0" aria-hidden />
          <p>
            <strong className="font-semibold">Not saved.</strong> Import it to
            keep this story. Generating again replaces it.
          </p>
        </div>
        {importError ? (
          <ErrorMessage
            className="mt-3"
            error={getApiErrorMessage(importError)}
            title="Could not import this story"
          />
        ) : null}
      </div>

      <div
        className="min-h-0 flex-1 space-y-4 overscroll-contain p-5 pt-4 sm:p-6 sm:pt-4 xl:overflow-y-auto"
        data-testid="generated-story-body"
      >
        {pages.length > 0 ? (
          <article
            aria-label="Generated story"
            className="space-y-4 scroll-mt-20 type-section leading-9 text-foreground outline-none"
            ref={articleRef}
            tabIndex={-1}
          >
            {paragraphsByPage.map(({ page, paragraphs, start }) => (
              <section key={page.index} className="space-y-3">
                {paragraphs.map((paragraph, paragraphIndex) => (
                  <StoryParagraphView
                    key={`${page.index}-${paragraphIndex}`}
                    paragraph={paragraph}
                    paragraphIndex={start + paragraphIndex}
                    onOpenLemma={openLemma}
                  />
                ))}
              </section>
            ))}
          </article>
        ) : (
          <p className="type-caption text-muted-foreground">
            This story is no longer available. Generate another one to keep
            reading.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-4 type-caption-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded-full bg-warning-50" />
            New
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded-full bg-primary-40" />
            Learning
          </span>
        </div>
      </div>
    </AppCard>
  );
}
