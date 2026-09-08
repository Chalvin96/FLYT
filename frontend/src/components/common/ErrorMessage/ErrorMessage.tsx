import { AlertCircle, X } from 'lucide-react';

import { Button } from '@/components/common/Button/Button';
import { cn } from '@/lib/utils';

export interface ErrorMessageProps {
  error: Error | string;
  title?: string;
  onRetry?: () => void;
  retryLabel?: string;
  onDismiss?: () => void;
  role?: 'alert' | 'none';
  className?: string;
}

export function ErrorMessage({
  error,
  title = 'Something went wrong',
  onRetry,
  retryLabel = 'Retry',
  onDismiss,
  role = 'alert',
  className,
}: ErrorMessageProps) {
  const message = typeof error === 'string' ? error : error.message;

  return (
    <div
      role={role}
      className={cn(
        'flex items-start gap-3 radius-field border border-destructive-20 bg-destructive-10 p-3',
        className,
      )}
    >
      <AlertCircle className="mt-0.5 icon-md flex-shrink-0 text-destructive-60" />
      <div className="min-w-0 flex-1">
        <p className="type-caption font-medium text-destructive-90">{title}</p>
        <p className="mt-0.5 type-caption text-destructive-80">{message}</p>
      </div>
      <div className="flex flex-shrink-0 items-center gap-4">
        {onRetry && (
          <Button
            type="button"
            onClick={onRetry}
            variant="ghost"
            size="sm"
            className="relative h-7 px-2 text-muted-foreground after:absolute after:-inset-2 after:content-['']"
          >
            {retryLabel}
          </Button>
        )}
        {onDismiss && (
          <Button
            type="button"
            onClick={onDismiss}
            variant="ghost"
            size="icon"
            className="relative h-7 w-7 text-destructive-40 after:absolute after:-inset-2 after:content-[''] hover:text-destructive-60"
            aria-label="Dismiss"
          >
            <X className="icon-md" />
          </Button>
        )}
      </div>
    </div>
  );
}
