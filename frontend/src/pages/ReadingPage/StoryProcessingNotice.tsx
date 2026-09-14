import { Button } from '@/components/common/Button/Button';

export function StoryProcessingNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="mx-auto flex w-full max-w-2xl flex-col items-center gap-3 px-4 py-16 text-center"
      role="status"
      aria-live="polite"
    >
      <span className="type-label text-muted-foreground">Processing</span>
      <h1 className="type-title font-display text-foreground">
        Still processing this text
      </h1>
      <p className="type-body text-muted-foreground">
        We&apos;re turning your text into a tap-to-read story. This usually
        takes a few seconds. The page will update automatically when it&apos;s
        ready.
      </p>
      <Button
        type="button"
        variant="outline"
        className="mt-2"
        onClick={onRetry}
      >
        Check again
      </Button>
    </div>
  );
}
