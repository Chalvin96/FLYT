import { AlertCircle, X } from 'lucide-react';

import type { ClosedProps } from '../lib/closed';
import { Button } from './button';
import { Text } from './text';

export type ErrorMessageRetryProps =
  | { onRetry?: undefined; retryLabel?: undefined }
  | { onRetry: () => void; retryLabel: string };

export type ErrorMessageDismissProps =
  | { onDismiss?: undefined; dismissLabel?: undefined }
  | { onDismiss: () => void; dismissLabel: string };

export type ErrorMessageProps = ClosedProps<'div'> & {
  error: Error | string;
  role?: 'alert' | 'none';
  title: string;
} & ErrorMessageRetryProps &
  ErrorMessageDismissProps;

const ErrorMessage = ({
  dismissLabel,
  error,
  onDismiss,
  onRetry,
  retryLabel,
  role = 'alert',
  title,
  ...props
}: ErrorMessageProps) => {
  const message = typeof error === 'string' ? error : error.message;

  return (
    <div
      {...props}
      role={role}
      className="flex items-start gap-3 radius-field border border-danger-subtle bg-danger-subtle p-3"
      style={undefined}
    >
      <AlertCircle className="mt-0.5 icon-md shrink-0 text-icon-danger" />
      <div className="min-w-0 flex-1">
        <Text size="medium" weight="semibold" tone="danger">
          {title}
        </Text>
        <p className="mt-0.5">
          <Text as="span" size="medium" tone="danger">
            {message}
          </Text>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        {onRetry !== undefined && (
          <Button type="button" onClick={onRetry} variant="ghost" size="md">
            {retryLabel}
          </Button>
        )}
        {onDismiss !== undefined && (
          <Button
            type="button"
            onClick={onDismiss}
            variant="ghost"
            size="icon"
            aria-label={dismissLabel}
          >
            <X />
          </Button>
        )}
      </div>
    </div>
  );
};
ErrorMessage.displayName = 'ErrorMessage';

export { ErrorMessage };
