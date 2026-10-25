import type { ErrorComponentProps, LinkProps } from '@tanstack/react-router';

import { ErrorBoundary } from '@/components/common/ErrorBoundary/ErrorBoundary';

export function routeErrorComponent(
  title?: string,
  homeTo: LinkProps['to'] = '/home',
) {
  return function RouteErrorComponent({ error, reset }: ErrorComponentProps) {
    return (
      <ErrorBoundary
        error={error}
        homeTo={homeTo}
        reset={reset}
        title={title}
      />
    );
  };
}
