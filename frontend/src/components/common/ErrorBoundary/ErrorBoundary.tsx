import { useEffect } from 'react';
import { Link, type LinkProps } from '@tanstack/react-router';

import { AppCard } from '@/components/common/AppCard/AppCard';
import { Button } from '@/components/common/Button/Button';
import { ErrorMessage } from '@/components/common/ErrorMessage/ErrorMessage';
import { logClientError } from '@/lib/errors';

export interface ErrorBoundaryProps {
  error: unknown;
  reset?: () => void;
  title?: string;
  description?: string;
  badgeText?: string;
  resetLabel?: string;
  homeTo?: LinkProps['to'];
  homeLabel?: string;
  showHomeLink?: boolean;
  showError?: boolean;
  onLogError?: (error: unknown) => void;
  onHardReset?: () => void;
}

function toDisplayError(error: unknown): Error | string {
  if (!error) {
    return 'Request failed.';
  }

  if (error instanceof Error) {
    return error.message ? error : 'Request failed.';
  }

  if (typeof error === 'string') {
    return error || 'Request failed.';
  }

  return 'Please try again.';
}

function defaultLogError(error: unknown) {
  logClientError('Route error boundary captured an error.', error);
}

function defaultHardReset() {
  window.location.reload();
}

export function ErrorBoundary({
  error,
  reset,
  title = 'Something went wrong',
  description = '',
  badgeText = '',
  resetLabel = 'Try again',
  homeTo = '/home',
  homeLabel = 'Go home',
  showHomeLink = true,
  showError = true,
  onLogError = defaultLogError,
  onHardReset = defaultHardReset,
}: ErrorBoundaryProps) {
  useEffect(() => {
    if (!showError) {
      return;
    }

    onLogError(error);
  }, [error, onLogError, showError]);

  const handleReset = () => {
    if (reset) {
      reset();
      return;
    }

    onHardReset();
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg items-center px-4 py-6">
      <AppCard className="w-full p-5">
        {badgeText && (
          <p className="type-label text-muted-foreground">{badgeText}</p>
        )}
        <h1 className="type-title text-foreground">{title}</h1>
        {description && (
          <p className="mt-2 type-body text-muted-foreground">{description}</p>
        )}
        {showError && (
          <ErrorMessage
            error={toDisplayError(error)}
            title=""
            className="mt-4"
          />
        )}
        {(showError || showHomeLink) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {showError && (
              <Button
                type="button"
                onClick={handleReset}
                className="w-full sm:w-auto"
              >
                {resetLabel}
              </Button>
            )}
            {showHomeLink && (
              <Button asChild variant="ghost" className="w-full sm:w-auto">
                <Link to={homeTo}>{homeLabel}</Link>
              </Button>
            )}
          </div>
        )}
      </AppCard>
    </div>
  );
}
