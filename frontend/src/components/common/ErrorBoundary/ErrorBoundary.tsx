import { Button, Card, Heading, Text } from '@flyt/ui';
import { useEffect } from 'react';
import { Link, type LinkProps } from '@tanstack/react-router';

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
      <Card fillHeight padding="default">
        {badgeText && (
          <Heading as="div" size="xxsmall" tone="subtle">
            {badgeText}
          </Heading>
        )}
        <Heading as="h1" size="large" tone="default">
          {title}
        </Heading>
        {description && (
          <div className="mt-2">
            <Text as="p" size="large" tone="subtle">
              {description}
            </Text>
          </div>
        )}
        {showError && (
          <div className="mt-4">
            <ErrorMessage error={toDisplayError(error)} title="" />
          </div>
        )}
        {(showError || showHomeLink) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {showError && (
              <Button
                type="button"
                onClick={handleReset}
                width="full-on-mobile"
              >
                {resetLabel}
              </Button>
            )}
            {showHomeLink && (
              <Button asChild variant="ghost" width="full-on-mobile">
                <Link to={homeTo}>{homeLabel}</Link>
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
