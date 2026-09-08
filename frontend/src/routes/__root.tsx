import React from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';

import { ErrorBoundary } from '@/components/common/ErrorBoundary/ErrorBoundary';
import { LookupProvider } from '@/components/lookup/LookupProvider';

const TanStackRouterDevtools = import.meta.env.PROD
  ? () => null
  : React.lazy(() =>
      import('@tanstack/router-devtools').then((res) => ({
        default: res.TanStackRouterDevtools,
      })),
    );

type RouterContext = {
  queryClient: QueryClient;
};

function RootComponent() {
  return (
    <LookupProvider>
      <Outlet />
      <React.Suspense>
        <TanStackRouterDevtools />
      </React.Suspense>
    </LookupProvider>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  notFoundComponent: () => (
    <ErrorBoundary
      error={null}
      title="Page not found"
      badgeText="404"
      description="Check the link or go back home."
      homeTo="/home"
      showError={false}
    />
  ),
  errorComponent: ({ error, reset }) => (
    <ErrorBoundary error={error} reset={reset} homeTo="/home" />
  ),
});
