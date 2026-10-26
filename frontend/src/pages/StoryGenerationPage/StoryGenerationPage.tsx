import { Button, Card, Heading, Text } from '@flyt/ui';
import { Pencil, Sparkles } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from 'react';
import { useNavigate } from '@tanstack/react-router';

import { ErrorMessage } from '@/components/common/ErrorMessage/ErrorMessage';
import {
  useCreateStoryGeneration,
  useCurrentStoryGeneration,
  useImportCurrentStoryGeneration,
  useStoryGenerationSurface,
} from '@/hooks/storyGeneration/queries';
import { useIsDesktop } from '@/hooks/ui/useIsDesktop';
import { getApiErrorMessage } from '@/lib/apiError';

import {
  ANCHOR_COPY,
  PROVIDER_COPY,
  STORY_GENERATION_TOPIC_MAX_CHARACTERS,
} from './constants';
import { getRequestRefusal } from './format';
import { GenerationStatusSurface } from './GenerationStatusSurface';
import {
  RequestRefusalNotice,
  StoryGenerationLoading,
} from './RequestRefusalNotice';
import {
  AnchorFieldset,
  LengthFieldset,
  ProviderFieldset,
} from './StoryGenerationFieldsets';
import { buildStorySelection } from './storySelection';
import { StoryTopicField } from './StoryTopicField';

export interface StoryGenerationSearch {
  provider?: string;
  anchor?: string;
  length?: number;
  topic?: string;
}

export interface StoryGenerationPageProps {
  search: StoryGenerationSearch;
  onSearchChange: (patch: Partial<StoryGenerationSearch>) => void;
}

type CreateGeneration = ReturnType<typeof useCreateStoryGeneration>;
type Surface = Parameters<typeof buildStorySelection>[0];
type Selection = ReturnType<typeof buildStorySelection>;
type Submission = Parameters<CreateGeneration['mutate']>[0];

export function StoryGenerationPage({
  search,
  onSearchChange,
}: StoryGenerationPageProps) {
  const surfaceQuery = useStoryGenerationSurface();
  const currentQuery = useCurrentStoryGeneration();
  const createGeneration = useCreateStoryGeneration();
  const importGeneration = useImportCurrentStoryGeneration({
    onImported: handleImportSuccess,
  });
  const navigate = useNavigate();
  const topicInputRef = useRef<HTMLTextAreaElement>(null);
  const isDesktop = useIsDesktop();
  const [isEditing, setIsEditing] = useState(false);
  const [topicError, setTopicError] = useState<string | null>(null);

  useEffect(() => {
    if (topicError) topicInputRef.current?.focus();
  }, [topicError]);

  if (surfaceQuery.isPending) {
    return <StoryGenerationLoading />;
  }

  if (surfaceQuery.isError || !surfaceQuery.data) {
    return (
      <div className="container-max mx-auto w-full pb-10">
        <ErrorMessage
          error="Could not load story generation."
          onRetry={() => void surfaceQuery.refetch()}
        />
      </div>
    );
  }

  const surface = surfaceQuery.data;
  const current = currentQuery.data;
  const hasSearchSelection = Object.values(search).some(
    (value) => value !== undefined,
  );
  const effectiveSearch =
    !hasSearchSelection && current
      ? {
          provider: current.provider,
          anchor: current.anchor ?? undefined,
          length: current.length,
          topic: current.topic ?? undefined,
        }
      : search;
  const selection = buildStorySelection(surface, effectiveSearch);
  const requestRefusal = getRequestRefusal(createGeneration.error);

  function updateSearch(patch: Partial<StoryGenerationSearch>) {
    setIsEditing(true);
    createGeneration.reset();
    onSearchChange(
      hasSearchSelection ? patch : { ...effectiveSearch, ...patch },
    );
  }

  function handleTopicChange(value: string) {
    if (topicError !== null) setTopicError(null);
    updateSearch({ topic: value || undefined });
  }

  function submitGeneration() {
    if (!selection.selectedProvider || selection.selectedLength === undefined) {
      return;
    }

    const topic = selection.topic.trim();
    if (topic.length > STORY_GENERATION_TOPIC_MAX_CHARACTERS) {
      setIsEditing(true);
      setTopicError(
        `Keep the topic to ${STORY_GENERATION_TOPIC_MAX_CHARACTERS} characters or fewer.`,
      );
      return;
    }

    const submission: Submission = {
      provider: selection.selectedProvider.name,
      anchor: selection.selectedAnchor?.type,
      length: selection.selectedLength,
      topic: topic || undefined,
    };
    setIsEditing(false);
    createGeneration.mutate(submission);
  }

  function handleRetry() {
    if (createGeneration.isPending) return;

    submitGeneration();
  }

  function handleImportSuccess(item: { storyUuid: string }) {
    void navigate({
      params: { uuid: item.storyUuid },
      to: '/reading/story/$uuid',
    });
  }

  return (
    <div className="container-max mx-auto flex w-full flex-col gap-7 pb-10">
      <StoryGenerationHeader />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
        {isDesktop ||
        !currentQuery.data ||
        isEditing ||
        createGeneration.isError ? (
          <StoryGenerationFormCard
            createGeneration={createGeneration}
            requestRefusal={requestRefusal}
            selection={selection}
            surface={surface}
            topicError={topicError}
            topicInputRef={topicInputRef}
            onRetry={handleRetry}
            onSubmit={submitGeneration}
            onTopicChange={handleTopicChange}
            onUpdateSearch={updateSearch}
          />
        ) : (
          <GenerationSummary
            current={currentQuery.data}
            onEdit={() => setIsEditing(true)}
          />
        )}

        <GenerationStatusSurface
          current={currentQuery.data}
          importError={importGeneration.error}
          isCreating={createGeneration.isPending}
          isError={currentQuery.isError}
          isImporting={importGeneration.isPending}
          onImport={(title) => importGeneration.mutate(title)}
          onRetryCurrent={() => void currentQuery.refetch()}
          onRetryGeneration={handleRetry}
        />
      </div>
    </div>
  );
}

function GenerationSummary({
  current,
  onEdit,
}: {
  current: NonNullable<ReturnType<typeof useCurrentStoryGeneration>['data']>;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 radius-field border border-default bg-overlay p-3">
      <div className="min-w-0 space-y-1">
        <Text as="p" size="medium" weight="semibold">
          {ANCHOR_COPY[current.anchor ?? 'none']?.label ?? current.anchor} ·{' '}
          {current.length} words ·{' '}
          {PROVIDER_COPY[current.provider]?.label ?? current.provider}
        </Text>
        {current.topic ? (
          <div className="line-clamp-2 break-words">
            <Text
              as="p"
              size="small"
              tone="subtle"
              lang="nb"
              title={current.topic}
            >
              {current.topic}
            </Text>
          </div>
        ) : null}
      </div>
      <Button variant="link" size="sm" onClick={onEdit}>
        <Pencil className="icon-sm" aria-hidden />
        Edit
      </Button>
    </div>
  );
}

function StoryGenerationHeader() {
  return (
    <header className="space-y-3">
      <Heading as="h1" size="xlarge" tone="default">
        Generate a story to read
      </Heading>
      <div className="max-w-[64ch]">
        <Text as="p" size="medium" tone="subtle">
          Choose the words, length, and topic. Your story will be ready for word
          lookup before you save it.
        </Text>
      </div>
    </header>
  );
}

function StoryGenerationFormCard({
  createGeneration,
  requestRefusal,
  selection,
  surface,
  topicError,
  topicInputRef,
  onRetry,
  onSubmit,
  onTopicChange,
  onUpdateSearch,
}: {
  createGeneration: CreateGeneration;
  requestRefusal: string | null;
  selection: Selection;
  surface: Surface;
  topicError: string | null;
  topicInputRef: RefObject<HTMLTextAreaElement | null>;
  onRetry: () => void;
  onSubmit: () => void;
  onTopicChange: (value: string) => void;
  onUpdateSearch: (patch: Partial<StoryGenerationSearch>) => void;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <Card padding="default">
      <form className="space-y-6" onSubmit={handleSubmit}>
        <AnchorFieldset
          minDeckSize={surface.minDeckSize}
          onSelect={(anchorType) => onUpdateSearch({ anchor: anchorType })}
          selectedAnchorType={selection.selectedAnchor?.type}
          visibleAnchors={selection.visibleAnchors}
        />

        <StoryTopicField
          error={topicError}
          inputRef={topicInputRef}
          onSuggestionSelect={(suggestion) =>
            onUpdateSearch({ topic: suggestion })
          }
          onTopicChange={onTopicChange}
          suggestions={surface.topicSuggestions}
          topic={selection.topic}
        />

        <LengthFieldset
          lengthOptions={surface.lengthOptions}
          onSelect={(length) => onUpdateSearch({ length })}
          selectedLength={selection.selectedLength}
        />

        <ProviderFieldset
          onSelect={(providerName) =>
            onUpdateSearch({ provider: providerName })
          }
          providers={selection.providers}
          selectedProviderName={selection.selectedProvider?.name}
        />

        <Button
          width="full"
          disabled={
            !selection.selectedProvider ||
            selection.selectedLength === undefined ||
            createGeneration.isPending
          }
          type="submit"
        >
          {createGeneration.isPending ? 'Generating…' : 'Generate'}
          {!createGeneration.isPending ? (
            <Sparkles aria-hidden className="icon-sm" />
          ) : null}
        </Button>

        {!selection.selectedProvider ? (
          <Text size="medium" tone="subtle">
            No provider is available. Connect an account or try again later.
          </Text>
        ) : null}

        {requestRefusal ? (
          <RequestRefusalNotice message={requestRefusal} />
        ) : null}
        {createGeneration.isError && !requestRefusal ? (
          <ErrorMessage
            error={getApiErrorMessage(createGeneration.error)}
            onRetry={onRetry}
            retryLabel="Try again"
            title="Could not start the story"
          />
        ) : null}
      </form>
    </Card>
  );
}
