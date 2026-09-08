import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';

import { ChatGPTLinkSection } from '@/components/chatgptLink/ChatGPTLinkSection';
import { OpenRouterKeySection } from '@/components/openrouterKey/OpenRouterKeySection';
import { useLogout, useMe, useUpdateMe } from '@/hooks/auth/queries';

import { AccountProfileCard } from './AccountProfileCard';
import { DangerZone } from './DangerZone';
import { DeleteAccountModal } from './DeleteAccountModal';

export function AccountPage() {
  const { data: user } = useMe();
  const { isPending, logout } = useLogout();
  const updateMe = useUpdateMe();
  const navigate = useNavigate();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  async function handleSignOut() {
    await logout();
    void navigate({ replace: true, to: '/login' });
  }

  return (
    <div className="container-max mx-auto flex w-full max-w-2xl flex-col gap-4 pb-4">
      <AccountProfileCard
        isSigningOut={isPending}
        onSignOut={() => void handleSignOut()}
        updateMe={updateMe}
        user={user}
      />
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
