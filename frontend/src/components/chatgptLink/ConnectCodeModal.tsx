import { Check, Clock3, Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';

import type { PendingChatGPTAuthorization } from '@/api/chatgptLink';
import { Button } from '@/components/common/Button/Button';
import { Modal } from '@/components/common/Modal/Modal';

import { formatCountdown } from './chatGPTLinkCardFormat';

interface ConnectCodeModalProps {
  authorizationUrl: string;
  isOpen: boolean;
  isLapsed: boolean;
  pending: PendingChatGPTAuthorization | null;
  remaining: number;
  onClose: () => void;
  onRequestNewCode: () => void;
}

export function ConnectCodeModal({
  authorizationUrl,
  isOpen,
  isLapsed,
  pending,
  remaining,
  onClose,
  onRequestNewCode,
}: ConnectCodeModalProps) {
  const [copied, setCopied] = useState(false);

  return (
    <Modal
      description="Authorize Flyt on OpenAI's secure site."
      footer={
        <>
          <Button onClick={onClose} type="button" variant="ghost">
            Cancel
          </Button>
          {!isLapsed && pending ? (
            <Button asChild>
              <a href={authorizationUrl} rel="noreferrer" target="_blank">
                Open OpenAI
                <ExternalLink className="icon-sm" />
              </a>
            </Button>
          ) : (
            <Button
              onClick={() => {
                onClose();
                onRequestNewCode();
              }}
              type="button"
            >
              Get a new code
            </Button>
          )}
        </>
      }
      isOpen={isOpen}
      onClose={onClose}
      title="Connect ChatGPT"
    >
      {pending ? (
        <div className="space-y-5">
          <UserCodePanel
            onCopy={() => setCopied(true)}
            userCode={pending.user_code}
            copied={copied}
          />
          <ol className="space-y-3 type-caption text-foreground" role="list">
            <li>1. Open auth.openai.com/device</li>
            <li>2. Enter the code above</li>
            <li>3. Approve the request</li>
            <li>4. Come back here — Flyt finishes on its own</li>
          </ol>
          <ExpiryNotice isLapsed={isLapsed} remaining={remaining} />
        </div>
      ) : null}
    </Modal>
  );
}

function UserCodePanel({
  copied,
  onCopy,
  userCode,
}: {
  copied: boolean;
  onCopy: () => void;
  userCode: string;
}) {
  return (
    <div className="radius-field flex items-center justify-between gap-3 border border-primary-30 bg-primary-10 p-4">
      <strong className="type-lead tracking-wider text-primary-90">
        {userCode}
      </strong>
      <Button
        onClick={() => {
          void navigator.clipboard.writeText(userCode);
          onCopy();
        }}
        size="sm"
        type="button"
        variant="outline"
      >
        {copied ? <Check /> : <Copy />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}

function ExpiryNotice({
  isLapsed,
  remaining,
}: {
  isLapsed: boolean;
  remaining: number;
}) {
  return (
    <div className="radius-field flex gap-3 border border-warning/40 bg-warning/10 p-3 type-caption text-foreground">
      <Clock3 aria-hidden className="icon-sm shrink-0 text-warning-80" />
      <p>
        {isLapsed
          ? 'This code has expired. Nothing was lost.'
          : `Expires in ${formatCountdown(remaining)}. If it runs out, start again — nothing is lost.`}
      </p>
    </div>
  );
}
