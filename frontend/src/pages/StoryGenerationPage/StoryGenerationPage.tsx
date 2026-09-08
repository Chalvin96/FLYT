import { Sparkles } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
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
import { cn } from '@/lib/utils';

import { AnchorChoice } from './AnchorChoice';
import { STORY_GENERATION_TOPIC_MAX_CHARACTERS } from './constants';
import { getRequestRefusal } from './format';
import { GenerationStatusSurface } from './GenerationStatusSurface';
import { ProviderChoice } from './ProviderChoice';
import { radioGroupKeyDown } from './radioGroupKeyboard';
import {
  RequestRefusalNotice,
  StoryGenerationLoading,
} from './RequestRefusalNotice';
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
  const providers = surface.providers;
  const availableProviders = providers.filter((provider) => provider.available);
  const selectedProvider =
    availableProviders.find((provider) => provider.name === search.provider) ??
    availableProviders[0];
  const visibleAnchors = surface.anchors.filter(
    (anchor) => !(surface.deckCollapsesWithFrequency && anchor.type === 'deck'),
  );
  const availableAnchors = visibleAnchors.filter((anchor) => anchor.available);
  const selectedAnchor =
    availableAnchors.find((anchor) => anchor.type === search.anchor) ??
    availableAnchors[0];
  const selectedLength = surface.lengthOptions.includes(search.length ?? 0)
    ? search.length
    : surface.lengthOptions[0];
  const topic = search.topic ?? '';
  const requestRefusal = getRequestRefusal(createGeneration.error);
  const current = currentQuery.data;

  function updateSearch(patch: Partial<StoryGenerationSearch>) {
    createGeneration.reset();
    onSearchChange(patch);
  }

  function handleTopicChange(value: string) {
    if (topicError !== null) setTopicError(null);
    updateSearch({ topic: value || undefined });
  }

  function submitGeneration() {
    if (!selectedProvider || selectedLength === undefined) return;

    if (topic.trim().length > STORY_GENERATION_TOPIC_MAX_CHARACTERS) {
      setTopicError(
        `Keep the topic to ${STORY_GENERATION_TOPIC_MAX_CHARACTERS} characters or fewer.`,
      );
      topicInputRef.current?.focus();
      return;
    }

    createGeneration.mutate({
      provider: selectedProvider.name,
      anchor: selectedAnchor?.type,
      length: selectedLength,
      topic: topic.trim() || undefined,
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitGeneration();
  }

  function handleRetry() {
    if (createGeneration.isPending) return;

    submitGeneration();
  }

  function handleImportSuccess(item: { storyUuid: string }) {
    void navigate({
      to: '/reading/story/$uuid',
      params: { uuid: item.storyUuid },
    });
  }

  return (
    <div className="container-max mx-auto flex w-full flex-col gap-7 pb-10">
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

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(20rem,0.78fr)_minmax(0,1.22fr)]">
        <AppCard className="p-5 sm:p-6">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <fieldset className="space-y-3">
              <legend className="type-label text-muted-foreground">
                Build it from
              </legend>
              <div
                className="space-y-2"
                role="radiogroup"
                aria-label="Story direction"
                onKeyDown={radioGroupKeyDown((index) => {
                  const anchor = visibleAnchors[index];
                  if (anchor) updateSearch({ anchor: anchor.type });
                })}
              >
                {visibleAnchors.map((anchor) => {
                  const isSelected = selectedAnchor?.type === anchor.type;
                  return (
                    <AnchorChoice
                      key={anchor.type}
                      anchor={anchor}
                      selected={isSelected}
                      onSelect={() => updateSearch({ anchor: anchor.type })}
                      minDeckSize={surface.minDeckSize}
                    />
                  );
                })}
              </div>
            </fieldset>

            <StoryTopicField
              error={topicError}
              inputRef={topicInputRef}
              suggestions={surface.topicSuggestions}
              topic={topic}
              onSuggestionSelect={(suggestion) =>
                updateSearch({ topic: suggestion })
              }
              onTopicChange={handleTopicChange}
            />

            <fieldset className="space-y-3">
              <legend className="type-label text-muted-foreground">
                Length
              </legend>
              <div
                className="flex gap-2"
                role="radiogroup"
                aria-label="Story length"
                onKeyDown={radioGroupKeyDown((index) => {
                  const length = surface.lengthOptions[index];
                  if (length !== undefined) updateSearch({ length });
                })}
              >
                {surface.lengthOptions.map((length) => (
                  <button
                    key={length}
                    type="button"
                    role="radio"
                    aria-checked={selectedLength === length}
                    tabIndex={selectedLength === length ? 0 : -1}
                    className={cn(
                      'min-h-11 flex-1 radius-field border px-3 type-caption font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      selectedLength === length
                        ? 'border-primary-70 bg-primary-10 text-primary-90 shadow-inset'
                        : 'border-border bg-white-100 text-muted-foreground hover:border-secondary-30 hover:text-foreground',
                    )}
                    onClick={() => updateSearch({ length })}
                  >
                    {length} words
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="type-label text-muted-foreground">
                Written by
              </legend>
              <div
                className="space-y-2"
                role="radiogroup"
                aria-label="Story provider"
                onKeyDown={radioGroupKeyDown((index) => {
                  const provider = providers[index];
                  if (provider) updateSearch({ provider: provider.name });
                })}
              >
                {providers.map((provider) => (
                  <ProviderChoice
                    key={provider.name}
                    provider={provider}
                    selected={selectedProvider?.name === provider.name}
                    onSelect={() => updateSearch({ provider: provider.name })}
                  />
                ))}
              </div>
            </fieldset>

            <Button
              type="submit"
              className="w-full"
              disabled={
                !selectedProvider ||
                selectedLength === undefined ||
                createGeneration.isPending
              }
            >
              {createGeneration.isPending ? 'Generating…' : 'Generate'}
              {!createGeneration.isPending ? (
                <Sparkles className="icon-sm" aria-hidden />
              ) : null}
            </Button>

            {!selectedProvider ? (
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
                title="Could not start the story"
                onRetry={handleRetry}
                retryLabel="Try again"
              />
            ) : null}
          </form>
        </AppCard>

        <GenerationStatusSurface
          current={current}
          isCreating={createGeneration.isPending}
          isError={currentQuery.isError}
          onRetryCurrent={() => void currentQuery.refetch()}
          onRetryGeneration={handleRetry}
          onImport={(title) => importGeneration.mutate(title)}
          isImporting={importGeneration.isPending}
          importError={importGeneration.error}
        />
      </div>
    </div>
  );
}
