import { Skeleton } from '@flyt/ui';

import { StoryReaderLayout } from './StoryReaderLayout';

export function StoryReaderPending() {
  return (
    <StoryReaderLayout loading footer={<StoryReaderFooterSkeleton />}>
      <StoryReaderLoading />
    </StoryReaderLayout>
  );
}

export function StoryReaderLoading() {
  return (
    <div
      className="mx-auto w-full max-w-prose space-y-8 pt-4"
      role="status"
      aria-label="Loading story"
    >
      {[
        ['full', 'long', 'full', 'medium'],
        ['long', 'full', 'long', 'full', 'short'],
        ['full', 'long', 'medium'],
      ].map((lines, index) => (
        <div className="space-y-4" key={index} aria-hidden>
          {lines.map((length, lineIndex) => (
            <Skeleton
              key={lineIndex}
              length={
                length === 'short'
                  ? 'short'
                  : length === 'medium'
                    ? 'medium'
                    : length === 'long'
                      ? 'long'
                      : 'full'
              }
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function StoryReaderFooterSkeleton() {
  return (
    <div
      className="mx-auto flex max-w-prose items-center gap-6 px-4 py-3"
      aria-hidden
    >
      <div className="w-28">
        <Skeleton variant="control" size="md" />
      </div>
      <div className="flex-1">
        <Skeleton />
      </div>
      <div className="w-24">
        <Skeleton variant="control" size="md" />
      </div>
    </div>
  );
}
