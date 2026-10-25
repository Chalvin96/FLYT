import {
  ErrorMessage as UiErrorMessage,
  type ErrorMessageDismissProps,
  type ErrorMessageRetryProps,
} from '@flyt/ui';

export interface ErrorMessageProps {
  error: Error | string;
  title?: string;
  onRetry?: () => void;
  retryLabel?: string;
  onDismiss?: () => void;
  dismissLabel?: string;
  role?: 'alert' | 'none';
}

export function ErrorMessage({
  dismissLabel = 'Dismiss',
  error,
  onDismiss,
  onRetry,
  retryLabel = 'Retry',
  role = 'alert',
  title = 'Something went wrong',
}: ErrorMessageProps) {
  const retry: ErrorMessageRetryProps =
    onRetry === undefined ? {} : { onRetry, retryLabel };
  const dismiss: ErrorMessageDismissProps =
    onDismiss === undefined ? {} : { onDismiss, dismissLabel };

  return (
    <UiErrorMessage
      {...dismiss}
      {...retry}
      error={error}
      role={role}
      title={title}
    />
  );
}
