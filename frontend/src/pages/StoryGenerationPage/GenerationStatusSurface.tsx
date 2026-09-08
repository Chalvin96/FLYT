import { Badge } from '@flyt/ui';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { AppCard } from '@/components/common/AppCard/AppCard';
import { Button } from '@/components/common/Button/Button';
import { ErrorMessage } from '@/components/common/ErrorMessage/ErrorMessage';
import { cn } from '@/lib/utils';
import type { StoryGenerationCurrentResponse } from '@/types/api';

import { STORY_GENERATION_PROCESSING_STALL_BACKSTOP_MS } from './constants';
import { GeneratedStory } from './GeneratedStory';

export function GenerationStatusSurface({
  current,
  isCreating,
  isError,
  onRetryCurrent,
  onRetryGeneration,
  onImport,
  isImporting,
  importError,
}: {
  current: StoryGenerationCurrentResponse | null | undefined;
  isCreating: boolean;
  isError: boolean;
  onRetryCurrent: () => void;
  onRetryGeneration: () => void;
  onImport: (title?: string) => void;
  isImporting: boolean;
  importError: unknown;
}) {
  if (isError && !current) {
    return (
      <div className="space-y-4">
        <h2 className="type-section font-semibold text-foreground">
          Your story
        </h2>
        <ErrorMessage
          error="Could not check the current story."
          onRetry={onRetryCurrent}
        />
      </div>
    );
  }

  if (!current) {
    return <EmptyGenerationState />;
  }

  if (current.status === 'processing') {
    return (
      <ProcessingState
        key={current.generationId}
        onRetry={onRetryGeneration}
        isRetryPending={isCreating}
      />
    );
  }

  if (current.status === 'refused') {
    return (
      <RefusedState
        current={current}
        onRetry={onRetryGeneration}
        isRetryPending={isCreating}
      />
    );
  }

  if (current.status === 'failed') {
    return (
      <FailedState
        current={current}
        onRetry={onRetryGeneration}
        isRetryPending={isCreating}
      />
    );
  }

  return (
    <GeneratedStory
      current={current}
      onGenerateAnother={onRetryGeneration}
      onImport={onImport}
      isGenerating={isCreating}
      isImporting={isImporting}
      importError={importError}
    />
  );
}

export function EmptyGenerationState() {
  return (
    <AppCard className="p-6 sm:p-8">
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary-10 text-primary-80">
          <Sparkles className="icon-md" aria-hidden />
        </div>
        <h2 className="type-section font-semibold text-foreground">
          Your story will appear here
        </h2>
        <p className="max-w-[38ch] type-caption text-muted-foreground">
          Pick a focus and a length, then start a story when you&apos;re ready.
        </p>
      </div>
    </AppCard>
  );
}

export function ProcessingState({
  onRetry,
  isRetryPending,
}: {
  onRetry: () => void;
  isRetryPending: boolean;
}) {
  const [isStalled, setIsStalled] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(
      () => setIsStalled(true),
      STORY_GENERATION_PROCESSING_STALL_BACKSTOP_MS,
    );
    return () => window.clearTimeout(id);
  }, []);

  const title = isStalled
    ? 'Your story is taking longer than usual'
    : 'Writing your story';
  const message = isStalled
    ? 'You can try again to start a new generation.'
    : "Usually about ten seconds. We're preparing it for word lookup as soon as the writing is done.";

  return (
    <AppCard className="p-6 sm:p-8">
      <div
        className="flex min-h-64 flex-col items-center justify-center gap-5 text-center"
        role="status"
        aria-live="polite"
      >
        <div
          className="size-8 animate-spin rounded-full border-[3px] border-secondary-20 border-t-primary-70"
          aria-label="Generating"
        />
        <div className="space-y-1">
          <h2 className="type-section font-semibold text-foreground">
            {title}
          </h2>
          <p className="type-caption text-muted-foreground">{message}</p>
        </div>
        {isStalled ? (
          <Button
            type="button"
            variant="outline"
            onClick={onRetry}
            disabled={isRetryPending}
          >
            Try again
          </Button>
        ) : null}
      </div>
    </AppCard>
  );
}

export function RefusedState({
  current,
  onRetry,
  isRetryPending,
}: {
  current: StoryGenerationCurrentResponse;
  onRetry: () => void;
  isRetryPending: boolean;
}) {
  return (
    <StatusCard
      tone="warning"
      label="Not started"
      title="Flyt did not start this story"
      message={
        current.failureMessage ??
        'This request was refused before a provider wrote any text.'
      }
      code={current.failureCode}
    >
      <p className="type-caption text-muted-foreground">
        No provider request was made.
      </p>
      <Button
        type="button"
        variant="outline"
        onClick={onRetry}
        disabled={isRetryPending}
      >
        Try again
      </Button>
    </StatusCard>
  );
}

export function FailedState({
  current,
  onRetry,
  isRetryPending,
}: {
  current: StoryGenerationCurrentResponse;
  onRetry: () => void;
  isRetryPending: boolean;
}) {
  return (
    <StatusCard
      tone="danger"
      label="Attempted, but not finished"
      title="The story could not be finished"
      message={
        current.failureMessage ??
        'The provider did not return a complete story. Nothing partial is shown.'
      }
      code={current.failureCode}
    >
      <p className="type-caption text-muted-foreground">
        The provider request was sent, but no story was saved.
      </p>
      <Button
        type="button"
        variant="outline"
        onClick={onRetry}
        disabled={isRetryPending}
      >
        Try again
      </Button>
    </StatusCard>
  );
}

export function StatusCard({
  tone,
  label,
  title,
  message,
  code,
  children,
}: {
  tone: 'warning' | 'danger';
  label: string;
  title: string;
  message: string;
  code: string | null;
  children: ReactNode;
}) {
  const warning = tone === 'warning';
  return (
    <AppCard
      className={cn(
        'radius-section p-5 shadow-raised sm:p-6',
        warning
          ? 'border-warning-30 bg-warning-10/70'
          : 'border-destructive-30 bg-destructive-10/70',
      )}
      data-testid={warning ? 'generation-refused' : 'generation-failed'}
      role="alert"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle
            className={cn(
              'mt-0.5 icon-md shrink-0',
              warning ? 'text-warning-70' : 'text-destructive-70',
            )}
            aria-hidden
          />
          <div className="min-w-0 space-y-1">
            <Badge
              variant="outline"
              className={cn(
                'type-caption-sm',
                warning
                  ? 'border-warning-30 bg-warning-10 text-warning-80'
                  : 'border-destructive-30 bg-destructive-10 text-destructive-80',
              )}
            >
              {label}
            </Badge>
            <h2 className="type-section font-semibold text-foreground">
              {title}
            </h2>
            <p className="type-caption text-muted-foreground">{message}</p>
          </div>
        </div>
        {code ? (
          <p className="font-mono type-caption-sm text-muted-foreground">
            {code}
          </p>
        ) : null}
        <div className="space-y-3 border-t border-current/10 pt-3">
          {children}
        </div>
      </div>
    </AppCard>
  );
}
