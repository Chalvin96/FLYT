import { Bot, Check, Clock3, Copy, ExternalLink, Info } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { ChatGPTLink, ChatGPTLinkStart } from '@/api/chatgptLink';
import { AppCard } from '@/components/common/AppCard/AppCard';
import { Button } from '@/components/common/Button/Button';
import { Modal } from '@/components/common/Modal/Modal';

const CONNECTED_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'long',
});

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

function secondsRemaining(expiresAt: string): number {
  return Math.max(
    0,
    Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000),
  );
}

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
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
  const pending = working ? null : (authorization ?? link.pending);
  const remaining = useCountdown(pending?.expires_at ?? null);
  const isLapsed = Boolean(pending && remaining === 0);
  const [isCodeOpen, setIsCodeOpen] = useState(false);
  const [dismissedCode, setDismissedCode] = useState<string | null>(null);
  const [isDisconnectOpen, setIsDisconnectOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const broken = link.state === 'broken';
  const caption = pending
    ? isLapsed
      ? 'Code expired'
      : `${pending.user_code} · expires in ${formatCountdown(remaining)}`
    : working && link.connected_at
      ? `Connected ${CONNECTED_DATE_FORMATTER.format(new Date(link.connected_at))}`
      : broken
        ? 'Disconnected'
        : 'Not connected';

  const codeIsOpen =
    Boolean(pending) &&
    (isCodeOpen ||
      (Boolean(authorization) && dismissedCode !== pending?.user_code));

  function closeCode() {
    setIsCodeOpen(false);
    if (pending) setDismissedCode(pending.user_code);
  }

  function handlePrimaryAction() {
    if (pending && !isLapsed) {
      setIsCodeOpen(true);
    } else if (working) {
      setIsDisconnectOpen(true);
    } else {
      onConnect();
    }
  }

  const actionLabel = pending
    ? isLapsed
      ? 'Get a new code'
      : 'Show code'
    : working
      ? 'Disconnect'
      : broken
        ? 'Reconnect'
        : 'Connect';

  return (
    <>
      <AppCard className="space-y-4 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="radius-field flex size-11 shrink-0 items-center justify-center bg-secondary-20 text-secondary-90">
              <Bot className="icon-sm" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="type-section font-semibold text-foreground">
                ChatGPT
              </p>
              <p
                className={
                  broken
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
              variant={working ? 'outline' : pending ? 'outline' : 'default'}
            >
              {isStarting ? 'Connecting…' : actionLabel}
            </Button>
          ) : null}
        </div>

        {broken ? (
          <div
            className="radius-field flex gap-3 border border-destructive/30 bg-destructive/10 p-3 type-caption text-foreground"
            role="alert"
          >
            <Info className="icon-sm shrink-0 text-destructive" aria-hidden />
            <p>
              The connection stopped working because another application signed
              in to the same ChatGPT account refreshed the credential.
            </p>
          </div>
        ) : null}

        {isLapsed ? (
          <div className="radius-field flex gap-3 border border-border bg-secondary-10 p-3 type-caption text-foreground">
            <Info
              className="icon-sm shrink-0 text-muted-foreground"
              aria-hidden
            />
            <p>This code has expired. Get a new code to continue.</p>
          </div>
        ) : null}

        {failure ? (
          <div
            className="radius-field flex flex-col gap-2 border border-warning/40 bg-warning/10 p-3 type-caption text-foreground"
            role="alert"
          >
            <div className="flex gap-3">
              <Info className="icon-sm shrink-0 text-warning-80" aria-hidden />
              <p>{failure.message}</p>
            </div>
            {failure.cta ? (
              <Button
                className="self-start"
                onClick={failure.cta.onClick}
                size="sm"
                type="button"
                variant="outline"
              >
                {failure.cta.label}
              </Button>
            ) : null}
          </div>
        ) : null}

        {terminalIneligible ? (
          <div
            className="radius-field flex gap-3 border border-warning/40 bg-warning/10 p-3 type-caption text-foreground"
            role="alert"
          >
            <Info className="icon-sm shrink-0 text-warning-80" aria-hidden />
            <p>
              Your ChatGPT plan does not include the usage Flyt needs. A Plus or
              Pro plan is required. Nothing was connected or charged.
            </p>
          </div>
        ) : null}
      </AppCard>

      <Modal
        isOpen={codeIsOpen}
        onClose={closeCode}
        title="Connect ChatGPT"
        description="Authorize Flyt on OpenAI's secure site."
        footer={
          <>
            <Button type="button" variant="ghost" onClick={closeCode}>
              Cancel
            </Button>
            {!isLapsed && pending ? (
              <Button asChild>
                <a
                  href={
                    authorization?.verification_url ??
                    'https://auth.openai.com/device'
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  Open OpenAI
                  <ExternalLink className="icon-sm" />
                </a>
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => {
                  closeCode();
                  onConnect();
                }}
              >
                Get a new code
              </Button>
            )}
          </>
        }
      >
        {pending ? (
          <div className="space-y-5">
            <div className="radius-field flex items-center justify-between gap-3 border border-primary-30 bg-primary-10 p-4">
              <strong className="type-lead tracking-wider text-primary-90">
                {pending.user_code}
              </strong>
              <Button
                size="sm"
                type="button"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(pending.user_code);
                  setCopied(true);
                }}
              >
                {copied ? <Check /> : <Copy />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <ol className="space-y-3 type-caption text-foreground" role="list">
              <li>1. Open auth.openai.com/device</li>
              <li>2. Enter the code above</li>
              <li>3. Approve the request</li>
              <li>4. Come back here — Flyt finishes on its own</li>
            </ol>
            <div className="radius-field flex gap-3 border border-warning/40 bg-warning/10 p-3 type-caption text-foreground">
              <Clock3
                className="icon-sm shrink-0 text-warning-80"
                aria-hidden
              />
              <p>
                {isLapsed
                  ? 'This code has expired. Nothing was lost.'
                  : `Expires in ${formatCountdown(remaining)}. If it runs out, start again — nothing is lost.`}
              </p>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={isDisconnectOpen}
        onClose={() => setIsDisconnectOpen(false)}
        title="Disconnect ChatGPT?"
        description="Flyt will delete its copy of the connection and ask OpenAI to revoke it."
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDisconnectOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDisconnecting}
              onClick={async () => {
                if ((await onDisconnect()) !== false)
                  setIsDisconnectOpen(false);
              }}
            >
              {isDisconnecting ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          </>
        }
      >
        <p className="type-caption text-muted-foreground">
          Deleting your Flyt account also asks OpenAI to revoke this connection.
        </p>
      </Modal>
    </>
  );
}
