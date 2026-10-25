import { ErrorMessage } from '@flyt/ui';

import { StoryReaderLayout } from './StoryReaderLayout';

export function StoryReaderError({ onRetry }: { onRetry: () => void }) {
  return (
    <StoryReaderLayout>
      <div className="mx-auto w-full max-w-prose">
        <ErrorMessage
          title="Couldn't open this story"
          error="Check your connection and try again."
          onRetry={onRetry}
          retryLabel="Try again"
        />
      </div>
    </StoryReaderLayout>
  );
}
