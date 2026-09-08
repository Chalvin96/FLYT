import { Loader2 } from 'lucide-react';
import type { ReactNode, RefObject } from 'react';

import { Button } from '@/components/common/Button/Button';
import { cn } from '@/lib/utils';

import type { FooterView, StatusTone } from './operationShellView';

const STATUS_TONE_CLASS: Record<StatusTone, string> = {
  accent: 'text-accent-80',
  destructive: 'text-destructive',
  muted: 'text-muted-foreground',
};

export function OperationFooterBar({
  ariaLive,
  continueRef,
  escapeAction,
  footerView,
  reducedMotion,
  status,
  statusFirstOnMobile,
  statusTone,
}: {
  ariaLive: 'polite' | undefined;
  continueRef: RefObject<HTMLButtonElement | null>;
  escapeAction?: ReactNode;
  footerView: FooterView;
  reducedMotion: boolean;
  status: string;
  statusFirstOnMobile: boolean;
  statusTone: StatusTone;
}) {
  return (
    <div
      className={cn(
        'flex gap-2 sm:flex-row sm:items-center sm:justify-between',
        statusFirstOnMobile ? 'flex-col' : 'flex-col-reverse',
      )}
      data-testid="flashcard-footer"
    >
      <p
        aria-live={ariaLive}
        className={cn('type-caption', STATUS_TONE_CLASS[statusTone])}
        data-testid="flashcard-action-status"
      >
        {status}
      </p>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
        {escapeAction}
        <FooterActions
          continueRef={continueRef}
          reducedMotion={reducedMotion}
          view={footerView}
        />
      </div>
    </div>
  );
}

function FooterActions({
  continueRef,
  reducedMotion,
  view,
}: {
  continueRef: RefObject<HTMLButtonElement | null>;
  reducedMotion: boolean;
  view: FooterView;
}) {
  switch (view.kind) {
    case 'pending':
      return (
        <Button className="w-full sm:w-auto" disabled variant="pill">
          <Loader2
            aria-hidden="true"
            className={cn('mr-1 size-4', !reducedMotion && 'animate-spin')}
          />
          {view.label}
        </Button>
      );
    case 'continue':
      return (
        <Button
          className="w-full sm:w-auto"
          disabled={view.disabled}
          onClick={view.onContinue}
          ref={continueRef}
          variant="pill"
        >
          Continue
          <span aria-hidden="true" className="ml-0.5">
            →
          </span>
        </Button>
      );
    case 'check':
      return (
        <Button
          className="w-full sm:w-auto"
          disabled={view.disabled}
          onClick={view.onCheck}
          variant="pill"
        >
          Check
          <span aria-hidden="true" className="ml-0.5">
            →
          </span>
        </Button>
      );
    case 'retryCheck':
      return (
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          {view.canReveal ? (
            <Button
              className="w-full sm:w-auto"
              onClick={view.onReveal}
              variant="outline"
            >
              Reveal answer
            </Button>
          ) : null}
          <Button
            className="w-full sm:w-auto"
            disabled={view.disabled}
            onClick={view.onCheck}
            variant="pill"
          >
            Check
            <span aria-hidden="true" className="ml-0.5">
              →
            </span>
          </Button>
        </div>
      );
  }
}
