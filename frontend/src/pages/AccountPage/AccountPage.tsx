import { LogOut, Mail, PencilLine, Save, UserRound } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';

import { ChatGPTLinkSection } from '@/components/chatgptLink/ChatGPTLinkSection';
import { AppCard } from '@/components/common/AppCard/AppCard';
import { Button } from '@/components/common/Button/Button';
import { OpenRouterKeySection } from '@/components/openrouterKey/OpenRouterKeySection';
import {
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useLogout, useMe, useUpdateMe } from '@/hooks/auth/queries';

import { DangerZone } from './DangerZone';
import { DeleteAccountModal } from './DeleteAccountModal';

const LAST_LOGIN_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatLastLogin(lastLogin: string | null) {
  if (!lastLogin) return 'Not recorded yet';

  return LAST_LOGIN_FORMATTER.format(new Date(lastLogin));
}

export function AccountPage() {
  const { data: user } = useMe();
  const { isPending, logout } = useLogout();
  const updateMe = useUpdateMe();
  const navigate = useNavigate();
  const displayName = user?.display_name ?? 'Your account';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'F';
  const [formError, setFormError] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const displayNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditingName) return;

    displayNameInputRef.current?.focus();
    displayNameInputRef.current?.select();
  }, [isEditingName]);

  async function handleSignOut() {
    await logout();
    void navigate({ replace: true, to: '/login' });
  }

  async function handleSaveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || updateMe.isPending || !isEditingName) return;

    const nextName = draftName.trim();

    if (!nextName) {
      setFormError('Enter a display name.');
      return;
    }

    setFormError(null);
    if (nextName === user.display_name) {
      setIsEditingName(false);
      return;
    }

    await updateMe.mutateAsync({ display_name: nextName });
    setIsEditingName(false);
  }

  function handleEditName() {
    setFormError(null);
    setDraftName(user?.display_name ?? '');
    setIsEditingName(true);
  }

  return (
    <div className="container-max mx-auto flex w-full max-w-2xl flex-col gap-4 pb-4">
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
              <CardTitle className="truncate type-title">
                {displayName}
              </CardTitle>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <form
            key={user?.display_name}
            className="radius-field border border-border bg-white-100 p-3"
            onSubmit={handleSaveName}
          >
            <label
              className="type-label-xs text-muted-foreground"
              htmlFor="display-name"
            >
              Display name
            </label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <Input
                className={
                  isEditingName
                    ? 'h-11'
                    : 'h-11 cursor-default border-secondary-20 bg-secondary-0 shadow-none focus-visible:ring-0'
                }
                id="display-name"
                maxLength={255}
                name="display_name"
                onChange={(event) => setDraftName(event.target.value)}
                readOnly={!isEditingName}
                ref={displayNameInputRef}
                value={isEditingName ? draftName : (user?.display_name ?? '')}
              />
              {isEditingName ? (
                <Button
                  className="h-11 sm:w-auto"
                  disabled={!user || updateMe.isPending}
                  type="submit"
                  variant="secondary"
                >
                  <Save className="icon-sm" />
                  {updateMe.isPending ? 'Saving...' : 'Save'}
                </Button>
              ) : (
                <Button
                  className="h-11 sm:w-auto"
                  disabled={!user}
                  onClick={handleEditName}
                  type="button"
                  variant="outline"
                >
                  <PencilLine className="icon-sm" />
                  Edit
                </Button>
              )}
            </div>
            {formError || updateMe.isError ? (
              <p className="type-caption mt-2 text-destructive-70">
                {formError ?? 'Could not update your name. Try again.'}
              </p>
            ) : null}
          </form>

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
              <p className="type-label-xs text-muted-foreground">
                Last sign in
              </p>
              <p className="font-semibold text-foreground">
                {formatLastLogin(user?.last_login ?? null)}
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t border-border pt-4">
          <Button
            className="h-11 w-full sm:w-auto"
            disabled={isPending}
            onClick={handleSignOut}
            type="button"
            variant="outline"
          >
            <LogOut className="icon-sm" />
            {isPending ? 'Signing out…' : 'Sign out'}
          </Button>
        </CardFooter>
      </AppCard>
      <ChatGPTLinkSection />
      <OpenRouterKeySection />

      {user ? <DangerZone onDelete={() => setIsDeleteOpen(true)} /> : null}

      {user ? (
        <DeleteAccountModal
          email={user.email}
          isOpen={isDeleteOpen}
          onClose={() => setIsDeleteOpen(false)}
          onDeleted={() =>
            void navigate({
              replace: true,
              search: { deleted: true },
              to: '/login',
            })
          }
          onUnconfirmed={() => window.location.assign('/login')}
        />
      ) : null}
    </div>
  );
}
