import { Badge, Button, Card, Heading, Text } from '@flyt/ui';
import { AlertTriangle } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

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
        <Heading as="h2" size="medium" tone="default">
          Your story
        </Heading>
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
    <div className="py-2 text-center lg:py-8">
      <Text as="p" size="medium" tone="subtle">
        Your story appears here, ready to tap through.
      </Text>
    </div>
  );
}

export function ProcessingState({
  onRetry,
  isRetryPending,
}: {
  onRetry: () => void;
  isRetryPending: boolean;
}) {
  const [startedWaitingAt] = useState(Date.now);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isStalled, setIsStalled] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(
      () => setIsStalled(true),
      STORY_GENERATION_PROCESSING_STALL_BACKSTOP_MS,
    );
    const interval = window.setInterval(
      () =>
        setElapsedSeconds(Math.floor((Date.now() - startedWaitingAt) / 1000)),
      1000,
    );
    return () => {
      window.clearTimeout(id);
      window.clearInterval(interval);
    };
  }, [startedWaitingAt]);

  const title = isStalled
    ? 'Your story is taking longer than usual'
    : 'Writing your story';
  const message = isStalled
    ? 'The writer is slower than usual. You can wait or start a new attempt.'
    : 'Usually about ten seconds. We’re getting the words ready for lookup.';

  return (
    <Card padding="roomy">
      <div className="flex min-h-64 flex-col items-center justify-center gap-5 text-center">
        <div
          className="size-8 animate-spin motion-reduce:animate-none rounded-full border-3 border-default border-t-selected"
          aria-hidden="true"
        />
        <div className="space-y-1" role="status" aria-live="polite">
          <Heading as="h2" size="medium" tone="default">
            {title}
          </Heading>
          <Text size="medium" tone="subtle">
            {message}
          </Text>
        </div>
        <Text as="p" size="small" tone="subtle">
          Waiting {elapsedSeconds} s · usually ~10 s
        </Text>
        {isStalled ? (
          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              onClick={onRetry}
              disabled={isRetryPending}
            >
              Try again
            </Button>
            <Text as="p" size="small" tone="subtle">
              Or keep waiting. It still appears here if it finishes.
            </Text>
          </div>
        ) : null}
      </div>
    </Card>
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
      <Text size="medium" tone="warning">
        No provider request was made.
      </Text>
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
      title="The story could not be finished"
      message={
        current.failureMessage ??
        'The provider did not return a complete story.'
      }
      code={current.failureCode}
    >
      <Text as="p" size="medium" tone="subtle">
        Nothing was saved. You can try again.
      </Text>
      <Button
        type="button"
        width="full"
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
  label?: string;
  title: string;
  message: string;
  code: string | null;
  children: ReactNode;
}) {
  const warning = tone === 'warning';
  return (
    <Card
      data-testid={warning ? 'generation-refused' : 'generation-failed'}
      role="alert"
      surface={warning ? 'warning' : 'danger'}
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle
            className={cn(
              'mt-0.5 icon-md shrink-0',
              warning ? 'text-icon-warning' : 'text-icon-danger',
            )}
            aria-hidden
          />
          <div className="min-w-0 space-y-1">
            {label ? (
              <Badge tone={warning ? 'warning' : 'danger'}>{label}</Badge>
            ) : null}
            <Heading as="h2" size="medium" tone="default">
              {title}
            </Heading>
            <Text size="medium" tone={warning ? 'warning' : 'subtle'}>
              {message}
            </Text>
          </div>
        </div>
        <div className="space-y-3 border-t border-current/10 pt-3">
          {children}
          {code ? (
            <details className="space-y-2">
              <summary className="cursor-pointer py-2">
                <Text as="span" size="small" tone="subtle">
                  Details
                </Text>
              </summary>
              <div className="break-all">
                <Text
                  as="p"
                  font="mono"
                  size="small"
                  tone={warning ? 'warning' : 'subtle'}
                >
                  {code}
                </Text>
              </div>
            </details>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
