import { Button, Text } from '@flyt/ui';
import { Loader2 } from 'lucide-react';
import type { ReactNode, RefObject } from 'react';

import { cn } from '@/lib/utils';

import { verdictFooterStatusClass, type StatusVerdict } from './answerVerdict';
import type { FooterView } from './operationShellView';

export function OperationFooterBar({
  ariaLive,
  continueRef,
  alternativeActions,
  footerView,
  reducedMotion,
  status,
  statusFirstOnMobile,
  statusVerdict,
}: {
  ariaLive: 'polite' | undefined;
  continueRef: RefObject<HTMLButtonElement | null>;
  alternativeActions?: ReactNode;
  footerView: FooterView;
  reducedMotion: boolean;
  status: string;
  statusFirstOnMobile: boolean;
  statusVerdict: StatusVerdict;
}) {
  return (
    <div
      className={cn(
        'flex gap-2 sm:flex-row sm:items-center sm:justify-between',
        statusFirstOnMobile ? 'flex-col' : 'flex-col-reverse',
      )}
      data-testid="flashcard-footer"
    >
      <div className={verdictFooterStatusClass[statusVerdict]}>
        <Text
          as="p"
          aria-live={ariaLive}
          data-testid="flashcard-action-status"
          size="medium"
        >
          {status}
        </Text>
      </div>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
        {alternativeActions}
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
        <Button width="full-on-mobile" disabled shape="pill">
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
          width="full-on-mobile"
          disabled={view.disabled}
          onClick={view.onContinue}
          ref={continueRef}
          shape="pill"
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
          width="full-on-mobile"
          disabled={view.disabled}
          onClick={view.onCheck}
          shape="pill"
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
              width="full-on-mobile"
              onClick={view.onReveal}
              variant="outline"
            >
              Reveal answer
            </Button>
          ) : null}
          <Button
            width="full-on-mobile"
            disabled={view.disabled}
            onClick={view.onCheck}
            shape="pill"
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
