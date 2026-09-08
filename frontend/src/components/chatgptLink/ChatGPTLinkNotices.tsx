import { Info } from 'lucide-react';

import { Button } from '@/components/common/Button/Button';

import type { ChatGPTLinkFailure } from './ChatGPTLinkCard';

const NOTICE_CONTAINER_CLASS =
  'radius-field flex gap-3 border p-3 type-caption text-foreground';

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
      className: 'border-destructive/30 bg-destructive/10',
      iconClassName: 'text-destructive',
    });
  }
  if (isLapsed) {
    notices.push({
      key: 'lapsed',
      message: 'This code has expired. Get a new code to continue.',
      alertRole: false,
      className: 'border-border bg-secondary-10',
      iconClassName: 'text-muted-foreground',
    });
  }
  if (terminalIneligible) {
    notices.push({
      key: 'terminalIneligible',
      message:
        'Your ChatGPT plan does not include the usage Flyt needs. A Plus or Pro plan is required. Nothing was connected or charged.',
      alertRole: true,
      className: 'border-warning/40 bg-warning/10',
      iconClassName: 'text-warning-80',
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
      <p>{message}</p>
    </div>
  );
}

function FailureNotice({ failure }: { failure: ChatGPTLinkFailure }) {
  return (
    <div
      className="radius-field flex flex-col gap-2 border border-warning/40 bg-warning/10 p-3 type-caption text-foreground"
      role="alert"
    >
      <div className="flex gap-3">
        <NoticeIcon iconClassName="text-warning-80" />
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
  );
}
