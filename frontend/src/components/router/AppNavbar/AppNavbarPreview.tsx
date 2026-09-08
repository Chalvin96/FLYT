import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';

import { LookupProvider } from '@/components/lookup/LookupProvider';
import { LookupSheet } from '@/components/lookup/LookupSheet';

import {
  AppAccountAvatarLink,
  AppDesktopNavbar,
  AppMobileNavbar,
} from './AppNavbar';
import { appNavItems, type AppNavPath } from './AppNavbar.config';
import { SearchIconButton } from './SearchIconButton';

function PreviewFrame({ children }: { children: ReactNode }) {
  const queryClient = useMemo(() => new QueryClient(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <LookupProvider>
        <div className="flex h-dvh flex-col bg-background text-foreground">
          <header className="shell-px sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border/60 bg-white-100 py-3">
            <span className="font-display type-section tracking-tight">
              Flyt
            </span>
            <div className="flex items-center gap-2 lg:hidden">
              <SearchIconButton />
              <AppAccountAvatarLink />
            </div>
            <AppDesktopNavbar />
          </header>
          <main className="shell-main flex-1 overflow-y-auto">{children}</main>
          <AppMobileNavbar />
          <LookupSheet />
        </div>
      </LookupProvider>
    </QueryClientProvider>
  );
}

export function AppNavbarPreview({
  children,
  initialPath = '/home',
}: {
  children?: ReactNode;
  initialPath?: AppNavPath | '/account';
}) {
  const router = useMemo(() => {
    const rootRoute = createRootRoute({
      component: () => (
        <PreviewFrame>
          <Outlet />
        </PreviewFrame>
      ),
    });

    const childRoutes = [
      ...appNavItems.map((item) =>
        createRoute({
          component: () => <>{children ?? null}</>,
          getParentRoute: () => rootRoute,
          path: item.to.slice(1),
        }),
      ),
      createRoute({
        component: () => <>{children ?? null}</>,
        getParentRoute: () => rootRoute,
        path: 'account',
      }),
    ];

    const routeTree = rootRoute.addChildren(childRoutes);

    return createRouter({
      history: createMemoryHistory({ initialEntries: [initialPath] }),
      routeTree,
    });
  }, [children, initialPath]);

  return <RouterProvider router={router} />;
}
