import { Bot } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { ChatGPTLink, ChatGPTLinkStart } from '@/api/chatgptLink';
import { AppCard } from '@/components/common/AppCard/AppCard';
import { Button } from '@/components/common/Button/Button';

import {
  formatLinkCaption,
  formatPrimaryActionLabel,
  getAuthorizationUrl,
  secondsRemaining,
} from './chatGPTLinkCardFormat';
import { ChatGPTLinkNotices } from './ChatGPTLinkNotices';
import { ConnectCodeModal } from './ConnectCodeModal';
import { DisconnectChatGPTModal } from './DisconnectChatGPTModal';

export interface ChatGPTLinkFailure {
  message: string;
  cta?: { label: string; onClick: () => void };
}

interface ChatGPTLinkCardProps {
  link: ChatGPTLink;
  authorization?: ChatGPTLinkStart | null;
  terminalIneligible?: boolean;
  failure?: ChatGPTLinkFailure | null;
  isStarting?: boolean;
  isDisconnecting?: boolean;
  onConnect: () => void;
  onDisconnect: () => boolean | void | Promise<boolean | void>;
}

function useCountdown(expiresAt: string | null) {
  const [remaining, setRemaining] = useState(() =>
    expiresAt ? secondsRemaining(expiresAt) : 0,
  );

  useEffect(() => {
    if (!expiresAt) return;
    const update = () => setRemaining(secondsRemaining(expiresAt));
    update();
    const interval = window.setInterval(update, 1_000);
    return () => window.clearInterval(interval);
  }, [expiresAt]);

  return remaining;
}

export function ChatGPTLinkCard({
  link,
  authorization,
  terminalIneligible = false,
  failure = null,
  isStarting = false,
  isDisconnecting = false,
  onConnect,
  onDisconnect,
}: ChatGPTLinkCardProps) {
  const working = link.state === 'working';
  const linkIsBroken = link.state === 'broken';
  const pending = working ? null : (authorization ?? link.pending);
  const remaining = useCountdown(pending?.expires_at ?? null);
  const isLapsed = Boolean(pending && remaining === 0);
  const [isCodeOpen, setIsCodeOpen] = useState(false);
  const [dismissedCode, setDismissedCode] = useState<string | null>(null);
  const [isDisconnectOpen, setIsDisconnectOpen] = useState(false);

  const caption = formatLinkCaption({
    connectedAt: link.connected_at,
    isLapsed,
    linkIsBroken,
    pending,
    remaining,
    working,
  });
  const actionLabel = formatPrimaryActionLabel({
    isLapsed,
    linkIsBroken,
    pending,
    working,
  });
  const actionVariant = working || pending ? 'outline' : 'default';

  const codeIsOpen =
    Boolean(pending) &&
    (isCodeOpen ||
      (Boolean(authorization) && dismissedCode !== pending?.user_code));

  const closeCode = () => {
    setIsCodeOpen(false);
    if (pending) setDismissedCode(pending.user_code);
  };

  const handlePrimaryAction = () => {
    if (pending && !isLapsed) {
      setIsCodeOpen(true);
    } else if (working) {
      setIsDisconnectOpen(true);
    } else {
      onConnect();
    }
  };

  return (
    <>
      <AppCard className="space-y-4 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="radius-field flex size-11 shrink-0 items-center justify-center bg-secondary-20 text-secondary-90">
              <Bot aria-hidden className="icon-sm" />
            </div>
            <div className="min-w-0">
              <p className="type-section font-semibold text-foreground">
                ChatGPT
              </p>
              <p
                className={
                  linkIsBroken
                    ? 'type-caption text-destructive'
                    : 'type-caption text-muted-foreground'
                }
              >
                {caption}
              </p>
            </div>
          </div>
          {!terminalIneligible ? (
            <Button
              className="shrink-0"
              disabled={isStarting || isDisconnecting}
              onClick={handlePrimaryAction}
              type="button"
              variant={actionVariant}
            >
              {isStarting ? 'Connecting…' : actionLabel}
            </Button>
          ) : null}
        </div>

        <ChatGPTLinkNotices
          failure={failure}
          isLapsed={isLapsed}
          linkIsBroken={linkIsBroken}
          terminalIneligible={terminalIneligible}
        />
      </AppCard>

      <ConnectCodeModal
        authorizationUrl={getAuthorizationUrl(authorization)}
        isOpen={codeIsOpen}
        isLapsed={isLapsed}
        pending={pending}
        remaining={remaining}
        onClose={closeCode}
        onRequestNewCode={onConnect}
      />

      <DisconnectChatGPTModal
        isOpen={isDisconnectOpen}
        isDisconnecting={isDisconnecting}
        onClose={() => setIsDisconnectOpen(false)}
        onDisconnect={onDisconnect}
      />
    </>
  );
}
