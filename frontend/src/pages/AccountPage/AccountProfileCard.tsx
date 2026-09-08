import { LogOut, Mail, UserRound } from 'lucide-react';

import { AppCard } from '@/components/common/AppCard/AppCard';
import { Button } from '@/components/common/Button/Button';
import {
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { useMe, useUpdateMe } from '@/hooks/auth/queries';

import { DisplayNameForm } from './DisplayNameForm';

const LAST_LOGIN_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatLastLogin(lastLogin: string | null) {
  if (!lastLogin) return 'Not recorded yet';

  return LAST_LOGIN_FORMATTER.format(new Date(lastLogin));
}

/** Profile card: avatar, editable display name, email, last sign in, sign out. */
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
    <AppCard data-testid="account-profile-card">
      <CardHeader className="gap-4">
        <div className="flex items-center gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary-30 bg-primary-20 type-lead font-bold text-primary-90">
            {user?.avatar_url ? (
              <img
                alt=""
                className="size-full object-cover"
                src={user.avatar_url}
              />
            ) : (
              <span>{initial}</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="type-label text-muted-foreground">Account</p>
            <CardTitle className="truncate type-title">{displayName}</CardTitle>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <DisplayNameForm updateMe={updateMe} user={user} />

        <div className="radius-field flex items-center gap-3 border border-border bg-white-100 p-3">
          <Mail className="icon-sm shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="type-label-xs text-muted-foreground">Email</p>
            <p className="truncate font-semibold text-foreground">
              {user?.email ?? 'Loading...'}
            </p>
          </div>
        </div>

        <div className="radius-field flex items-center gap-3 border border-border bg-white-100 p-3">
          <UserRound className="icon-sm shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="type-label-xs text-muted-foreground">Last sign in</p>
            <p className="font-semibold text-foreground">
              {formatLastLogin(user?.last_login ?? null)}
            </p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="border-t border-border pt-4">
        <Button
          className="h-11 w-full sm:w-auto"
          disabled={isSigningOut}
          onClick={onSignOut}
          type="button"
          variant="outline"
        >
          <LogOut className="icon-sm" />
          {isSigningOut ? 'Signing out…' : 'Sign out'}
        </Button>
      </CardFooter>
    </AppCard>
  );
}
