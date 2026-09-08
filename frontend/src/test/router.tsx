import type { ReactNode } from 'react';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';

export function createStoryRouter(
  story: ReactNode,
  initialEntries: string[],
  paths: string[],
) {
  const rootRoute = createRootRoute({
    component: () => <>{story}</>,
  });

  return createRouter({
    history: createMemoryHistory({ initialEntries }),
    routeTree: rootRoute.addChildren(
      paths.map((path) =>
        createRoute({
          getParentRoute: () => rootRoute,
          path,
          component: () => null,
        }),
      ),
    ),
  });
}
