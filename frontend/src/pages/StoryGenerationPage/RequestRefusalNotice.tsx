import { AlertTriangle } from 'lucide-react';

export function RequestRefusalNotice({ message }: { message: string }) {
  return (
    <div
      className="radius-field flex items-start gap-3 border border-warning-30 bg-warning-10 p-3"
      role="alert"
    >
      <AlertTriangle
        className="mt-0.5 icon-sm shrink-0 text-warning-70"
        aria-hidden
      />
      <div className="min-w-0 space-y-1">
        <p className="type-caption font-semibold text-warning-90">
          This story was not started
        </p>
        <p className="type-caption text-warning-90">{message}</p>
        <p className="type-caption-sm text-warning-90">
          No provider request was made. Try again later.
        </p>
      </div>
    </div>
  );
}

export function StoryGenerationLoading() {
  return (
    <div className="container-max mx-auto w-full space-y-6 pb-10">
      <div className="space-y-3">
        <div className="h-3 w-36 animate-pulse radius-sm bg-secondary-20" />
        <div className="h-10 w-80 max-w-full animate-pulse radius-sm bg-secondary-20" />
        <div className="h-5 w-full max-w-2xl animate-pulse radius-sm bg-secondary-10" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(20rem,0.78fr)_minmax(0,1.22fr)]">
        <div className="h-[42rem] animate-pulse radius-section bg-secondary-10" />
        <div className="h-[42rem] animate-pulse radius-section bg-secondary-10" />
      </div>
    </div>
  );
}
