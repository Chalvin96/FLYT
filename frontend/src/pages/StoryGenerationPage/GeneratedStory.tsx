import { Badge, Button, Card, Heading, Text } from '@flyt/ui';
import { Info } from 'lucide-react';
import { useMemo, useRef } from 'react';

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
    <div
      className="flex flex-col xl:max-h-[calc(100dvh-16rem)] xl:overflow-hidden"
      data-testid="generated-story"
    >
      <Card fillHeight padding="none">
        <div className="p-5 pb-4 sm:p-6 sm:pb-4">
          <div className="space-y-1">
            <Badge tone="brand">Ready to read</Badge>
            <div className="line-clamp-2 break-words">
              <Heading
                as="h2"
                size="large"
                tone="default"
                lang={current.topic ? 'nb' : undefined}
                title={current.topic ?? undefined}
              >
                {current.topic || 'Your generated story'}
              </Heading>
            </div>
            <Text size="medium" tone="subtle">
              About {current.length} words · {pages.length}{' '}
              {pages.length === 1 ? 'page' : 'pages'}
            </Text>
          </div>
        </div>

        <div
          className="sticky top-0 z-10 border-y border-default bg-raised px-5 py-3 sm:px-6 xl:static xl:z-auto xl:border-y-0 xl:px-0 xl:py-0"
          data-testid="generated-story-actions"
        >
          <div className="flex flex-wrap items-center gap-2 xl:border-b xl:border-default xl:pb-4">
            <Button
              type="button"
              disabled={isImporting || pages.length === 0}
              onClick={() => onImport()}
            >
              {isImporting ? 'Importing…' : 'Import to library'}
            </Button>
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
              variant="link"
              size="sm"
              onClick={onGenerateAnother}
              aria-describedby="generated-story-save-note"
              disabled={isGenerating}
            >
              {isGenerating ? 'Generating…' : 'Generate another'}
            </Button>
          </div>
          <div
            className="mt-3 flex items-start gap-3 radius-field bg-neutral-subtle px-3 py-3 text-subtle"
            id="generated-story-save-note"
          >
            <Info className="mt-0.5 icon-sm shrink-0" aria-hidden />
            <Text as="p" size="medium">
              <Text as="strong" weight="semibold">
                Not saved.
              </Text>{' '}
              Import it to keep this story. Generating again replaces it.
            </Text>
          </div>
          {importError ? (
            <div className="mt-3">
              <ErrorMessage
                error={getApiErrorMessage(importError)}
                title="Could not import this story"
              />
            </div>
          ) : null}
        </div>

        <div
          className="min-h-0 flex-1 space-y-4 overscroll-contain p-5 pt-4 sm:p-6 sm:pt-4 xl:overflow-y-auto"
          data-testid="generated-story-body"
        >
          {pages.length > 0 ? (
            <article
              aria-label="Generated story"
              lang="nb"
              className="scroll-mt-20 outline-none"
              ref={articleRef}
              tabIndex={-1}
            >
              <Text as="div" size="large" tone="default">
                <div className="space-y-4">
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
                </div>
              </Text>
            </article>
          ) : (
            <Text size="medium" tone="subtle">
              This story is no longer available. Generate another one to keep
              reading.
            </Text>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-default pt-4">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 rounded-full bg-[var(--border-strong)]" />
              <Text as="span" size="small" tone="subtle">
                New
              </Text>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 rounded-full bg-[var(--border-selected)]" />
              <Text as="span" size="small" tone="subtle">
                Learning
              </Text>
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
