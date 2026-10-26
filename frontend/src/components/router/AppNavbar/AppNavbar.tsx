import { Text } from '@flyt/ui';
import { CircleUserRound, Search } from 'lucide-react';
import { Link, useRouterState } from '@tanstack/react-router';

import { useLookupContext } from '@/components/lookup/useLookupContext';
import { cn } from '@/lib/utils';

import { appNavItems, type AppNavItem } from './AppNavbar.config';
import { SearchIconButton } from './SearchIconButton';

function isActivePath(pathname: string, item: AppNavItem) {
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export function AppAccountAvatarLink({ className }: { className?: string }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const active = pathname === '/account' || pathname.startsWith('/account/');

  return (
    <Link
      aria-current={active ? 'page' : undefined}
      aria-label="Account"
      className={cn(
        'inline-flex size-10 items-center justify-center rounded-full border transition-colors',
        active
          ? 'border-brand-subtle bg-selected-hovered text-selected'
          : 'border-default bg-raised text-subtle hover:bg-neutral-subtle hover:text-default',
        className,
      )}
      to="/account"
    >
      <CircleUserRound className="icon-sm" strokeWidth={1.9} />
    </Link>
  );
}

export function AppDesktopNavbar({
  className,
  hideSearch,
}: {
  className?: string;
  hideSearch?: boolean;
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <div className={cn('hidden lg:flex items-center gap-3', className)}>
      <nav aria-label="Desktop navigation" className="flex items-center gap-1">
        {appNavItems.map((item) => {
          const active = isActivePath(pathname, item);

          return (
            <Link
              key={item.to}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'radius-field inline-flex items-center px-3 py-2 transition-colors',
                active
                  ? 'bg-selected-hovered text-selected'
                  : 'text-subtle hover:bg-brand-subtle hover:text-default',
              )}
              to={item.to}
            >
              <Text as="span" size="medium" weight="semibold">
                {item.label}
              </Text>
            </Link>
          );
        })}
      </nav>
      {!hideSearch && <SearchIconButton />}
      <AppAccountAvatarLink />
    </div>
  );
}

export function AppMobileNavbar({ className }: { className?: string }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const lookup = useLookupContext();

  return (
    <div
      className={cn(
        'safe-bottom shadow-top sticky bottom-0 z-20 mt-auto shrink-0 border-t border-default bg-overlay backdrop-blur-sm lg:hidden',
        className,
      )}
    >
      <nav aria-label="Mobile navigation" className="px-2 pt-2">
        <ul role="list" className="grid grid-cols-5 gap-1">
          {appNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(pathname, item);

            return (
              <li key={item.to}>
                <Link
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex w-full flex-col items-center gap-1 px-1 py-1.5 transition-colors',
                    active ? 'text-default' : 'text-subtle hover:text-default',
                  )}
                  to={item.to}
                >
                  <span
                    className={cn(
                      'flex size-9 items-center justify-center rounded-full transition-colors',
                      active
                        ? 'border-2 border-selected bg-selected text-selected'
                        : 'text-current',
                    )}
                  >
                    <Icon className="icon-sm" strokeWidth={1.9} />
                  </span>
                  <Text as="span" size="small" weight="semibold">
                    {item.label}
                  </Text>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => lookup.openSearch()}
              className="flex w-full flex-col items-center gap-1 px-1 py-1.5 text-subtle transition-colors hover:text-default"
            >
              <span className="flex size-9 items-center justify-center rounded-full text-current">
                <Search className="icon-sm" strokeWidth={1.9} />
              </span>
              <Text as="span" size="small" weight="semibold">
                Dictionary
              </Text>
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}

export const AppNavbar = AppMobileNavbar;
