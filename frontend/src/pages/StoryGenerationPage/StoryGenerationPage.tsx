import { Sparkles } from 'lucide-react';
import { useRef, useState, type FormEvent, type RefObject } from 'react';
import { useNavigate } from '@tanstack/react-router';

import { AppCard } from '@/components/common/AppCard/AppCard';
import { Button } from '@/components/common/Button/Button';
import { ErrorMessage } from '@/components/common/ErrorMessage/ErrorMessage';
import {
  useCreateStoryGeneration,
  useCurrentStoryGeneration,
  useImportCurrentStoryGeneration,
  useStoryGenerationSurface,
} from '@/hooks/storyGeneration/queries';
import { getApiErrorMessage } from '@/lib/apiError';

import { STORY_GENERATION_TOPIC_MAX_CHARACTERS } from './constants';
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
  const topicInputRef = useRef<HTMLInputElement>(null);
  const [topicError, setTopicError] = useState<string | null>(null);

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
  const selection = buildStorySelection(surface, search);
  const requestRefusal = getRequestRefusal(createGeneration.error);

  function updateSearch(patch: Partial<StoryGenerationSearch>) {
    createGeneration.reset();
    onSearchChange(patch);
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
      setTopicError(
        `Keep the topic to ${STORY_GENERATION_TOPIC_MAX_CHARACTERS} characters or fewer.`,
      );
      topicInputRef.current?.focus();
      return;
    }

    const submission: Submission = {
      provider: selection.selectedProvider.name,
      anchor: selection.selectedAnchor?.type,
      length: selection.selectedLength,
      topic: topic || undefined,
    };
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

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(20rem,0.78fr)_minmax(0,1.22fr)]">
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

function StoryGenerationHeader() {
  return (
    <header className="space-y-3">
      <p className="type-label text-primary-80">Reading · Generate</p>
      <h1 className="type-hero font-display text-foreground">
        Generate a story to read
      </h1>
      <p className="max-w-[64ch] type-body text-muted-foreground">
        Choose what the story should build on, set its length, and give it a
        direction if you like. Every word will be ready for lookup before you
        save anything.
      </p>
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
  topicInputRef: RefObject<HTMLInputElement | null>;
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
    <AppCard className="p-5 sm:p-6">
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
          className="w-full"
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
          <p className="type-caption text-muted-foreground">
            No provider is available. Connect an account or try again later.
          </p>
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
    </AppCard>
  );
}
