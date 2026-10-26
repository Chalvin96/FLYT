import { Button, Text } from '@flyt/ui';
import { Info } from 'lucide-react';

import type { ChatGPTLinkFailure } from './ChatGPTLinkCard';

const NOTICE_CONTAINER_CLASS = 'radius-field flex gap-3 border p-3';

interface StaticNotice {
  key: 'broken' | 'lapsed' | 'terminalIneligible';
  message: string;
  alertRole: boolean;
  className: string;
  iconClassName: string;
}

function getStaticNotices({
  isLapsed,
  linkIsBroken,
  terminalIneligible,
}: {
  isLapsed: boolean;
  linkIsBroken: boolean;
  terminalIneligible: boolean;
}): StaticNotice[] {
  const notices: StaticNotice[] = [];
  if (linkIsBroken) {
    notices.push({
      key: 'broken',
      message:
        'The connection stopped working because another application signed in to the same ChatGPT account refreshed the credential.',
      alertRole: true,
      className: 'border-danger-subtle bg-danger/10',
      iconClassName: 'text-danger',
    });
  }
  if (isLapsed) {
    notices.push({
      key: 'lapsed',
      message: 'This code has expired. Get a new code to continue.',
      alertRole: false,
      className: 'border-default bg-neutral-subtle',
      iconClassName: 'text-subtle',
    });
  }
  if (terminalIneligible) {
    notices.push({
      key: 'terminalIneligible',
      message:
        'Your ChatGPT plan does not include the usage Flyt needs. A Plus or Pro plan is required. Nothing was connected or charged.',
      alertRole: true,
      className: 'border-warning-subtle bg-warning-subtle',
      iconClassName: 'text-icon-warning',
    });
  }
  return notices;
}

export function ChatGPTLinkNotices({
  failure,
  isLapsed,
  linkIsBroken,
  terminalIneligible,
}: {
  failure: ChatGPTLinkFailure | null;
  isLapsed: boolean;
  linkIsBroken: boolean;
  terminalIneligible: boolean;
}) {
  return (
    <>
      {getStaticNotices({
        isLapsed,
        linkIsBroken,
        terminalIneligible,
      }).map((notice) => (
        <NoticeRow
          alertRole={notice.alertRole}
          className={notice.className}
          iconClassName={notice.iconClassName}
          key={notice.key}
          message={notice.message}
        />
      ))}
      {failure ? <FailureNotice failure={failure} /> : null}
    </>
  );
}

function NoticeIcon({ iconClassName }: { iconClassName: string }) {
  return <Info aria-hidden className={`icon-sm shrink-0 ${iconClassName}`} />;
}

function NoticeRow({
  alertRole,
  className,
  iconClassName,
  message,
}: {
  alertRole: boolean;
  className: string;
  iconClassName: string;
  message: string;
}) {
  return (
    <div
      className={`${NOTICE_CONTAINER_CLASS} ${className}`}
      role={alertRole ? 'alert' : undefined}
    >
      <NoticeIcon iconClassName={iconClassName} />
      <Text as="p" size="medium" tone="default">
        {message}
      </Text>
    </div>
  );
}

function FailureNotice({ failure }: { failure: ChatGPTLinkFailure }) {
  return (
    <div
      className="radius-field flex flex-col gap-2 border border-warning-subtle bg-warning-subtle p-3"
      role="alert"
    >
      <div className="flex gap-3">
        <NoticeIcon iconClassName="text-icon-warning" />
        <Text as="p" size="medium" tone="default">
          {failure.message}
        </Text>
      </div>
      {failure.cta ? (
        <span className="self-start">
          <Button
            onClick={failure.cta.onClick}
            size="sm"
            type="button"
            variant="outline"
          >
            {failure.cta.label}
          </Button>
        </span>
      ) : null}
    </div>
  );
}
