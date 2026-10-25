import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Heading,
  Text,
} from '@flyt/ui';
import { LogOut, Mail, UserRound } from 'lucide-react';

import type { useMe, useUpdateMe } from '@/hooks/auth/queries';
import { parseUtcTimestamp } from '@/utils/date';

import { DisplayNameForm } from './DisplayNameForm';

const LAST_LOGIN_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

function formatLastLogin(lastLogin: string | null) {
  if (!lastLogin) return 'Not recorded yet';

  return LAST_LOGIN_FORMATTER.format(parseUtcTimestamp(lastLogin));
}

export function AccountProfileCard({
  user,
  isSigningOut,
  onSignOut,
  updateMe,
}: {
  user: ReturnType<typeof useMe>['data'];
  isSigningOut: boolean;
  onSignOut: () => void;
  updateMe: ReturnType<typeof useUpdateMe>;
}) {
  const displayName = user?.display_name ?? 'Your account';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'F';

  return (
    <Card data-testid="account-profile-card">
      <CardHeader>
        <div className="flex items-center gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand-subtle bg-selected-hovered text-selected">
            {user?.avatar_url ? (
              <img
                alt=""
                className="size-full object-cover"
                src={user.avatar_url}
              />
            ) : (
              <Heading as="span" size="medium">
                {initial}
              </Heading>
            )}
          </div>
          <div className="min-w-0">
            <Heading as="div" size="xxsmall" tone="subtle">
              Account
            </Heading>
            <CardTitle size="title" truncate>
              {displayName}
            </CardTitle>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          <DisplayNameForm updateMe={updateMe} user={user} />

          <div className="radius-field flex items-center gap-3 border border-default bg-overlay p-3">
            <Mail className="icon-sm shrink-0 text-subtle" />
            <div className="min-w-0">
              <Heading as="div" size="xxsmall" tone="subtle">
                Email
              </Heading>
              <div className="truncate">
                <Text as="p" size="large" weight="semibold">
                  {user?.email ?? 'Loading...'}
                </Text>
              </div>
            </div>
          </div>

          <div className="radius-field flex items-center gap-3 border border-default bg-overlay p-3">
            <UserRound className="icon-sm shrink-0 text-subtle" />
            <div className="min-w-0">
              <Heading as="div" size="xxsmall" tone="subtle">
                Last sign in
              </Heading>
              <div className="truncate">
                <Text as="p" size="large" weight="semibold">
                  {formatLastLogin(user?.last_login ?? null)}
                </Text>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter divided>
        <Button
          width="full-on-mobile"
          disabled={isSigningOut}
          onClick={onSignOut}
          type="button"
          variant="outline"
        >
          <LogOut className="icon-sm" />
          {isSigningOut ? 'Signing out…' : 'Sign out'}
        </Button>
      </CardFooter>
    </Card>
  );
}
