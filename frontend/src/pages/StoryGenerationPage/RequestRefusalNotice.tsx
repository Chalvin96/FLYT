import { Text } from '@flyt/ui';
import { AlertTriangle } from 'lucide-react';

export function RequestRefusalNotice({ message }: { message: string }) {
  return (
    <div
      className="radius-field flex items-start gap-3 border border-warning-subtle bg-warning-subtle p-3"
      role="alert"
    >
      <AlertTriangle
        className="mt-0.5 icon-sm shrink-0 text-icon-warning"
        aria-hidden
      />
      <div className="min-w-0 space-y-1">
        <div className="text-warning">
          <Text as="p" size="medium" weight="semibold">
            This story was not started
          </Text>
        </div>
        <div className="text-warning">
          <Text as="p" size="medium">
            {message}
          </Text>
        </div>
        <div className="text-warning">
          <Text as="p" size="small">
            No provider request was made. Try again later.
          </Text>
        </div>
      </div>
    </div>
  );
}

export function StoryGenerationLoading() {
  return (
    <div className="container-max mx-auto w-full space-y-6 pb-10">
      <div className="space-y-3">
        <div className="h-3 w-36 animate-pulse radius-sm bg-neutral-pressed" />
        <div className="h-10 w-80 max-w-full animate-pulse radius-sm bg-neutral-pressed" />
        <div className="h-5 w-full max-w-2xl animate-pulse radius-sm bg-neutral-subtle" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(20rem,0.78fr)_minmax(0,1.22fr)]">
        <div className="h-[42rem] animate-pulse radius-section bg-neutral-subtle" />
        <div className="h-[42rem] animate-pulse radius-section bg-neutral-subtle" />
      </div>
    </div>
  );
}
