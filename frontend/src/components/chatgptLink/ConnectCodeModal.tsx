import { Button, Heading, Modal, Text } from '@flyt/ui';
import { Check, Clock3, Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';

import type { PendingChatGPTAuthorization } from '@/api/chatgptLink';

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
          <ol className="space-y-3" role="list">
            <Text as="li" size="medium" tone="default">
              1. Open auth.openai.com/device
            </Text>
            <Text as="li" size="medium" tone="default">
              2. Enter the code above
            </Text>
            <Text as="li" size="medium" tone="default">
              3. Approve the request
            </Text>
            <Text as="li" size="medium" tone="default">
              4. Come back here — Flyt finishes on its own
            </Text>
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
    <div className="radius-field flex items-center justify-between gap-3 border border-brand-subtle bg-brand-subtle p-4">
      <Heading as="span" size="medium" tone="selected">
        {userCode}
      </Heading>
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
    <div className="radius-field flex gap-3 border border-warning-subtle bg-warning-subtle p-3">
      <Clock3 aria-hidden className="icon-sm shrink-0 text-icon-warning" />
      <Text as="p" size="medium" tone="default">
        {isLapsed
          ? 'This code has expired. Nothing was lost.'
          : `Expires in ${formatCountdown(remaining)}. If it runs out, start again — nothing is lost.`}
      </Text>
    </div>
  );
}
