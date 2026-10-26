import { Text } from '@flyt/ui';
import { Check, X } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

import {
  answerVerdictStatusText,
  verdictChipClass,
  type ChoiceVerdict,
} from '../answerVerdict';

export type TokenChipState = ChoiceVerdict | 'dragging' | 'fixed';

export interface TokenChipProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'ref' | 'className' | 'style'
> {
  text: string;
  state?: TokenChipState;
  grabbable?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}

const GRADED_VERDICT: Partial<
  Record<TokenChipState, { Icon: typeof Check; label: string | undefined }>
> = {
  correct: { Icon: Check, label: answerVerdictStatusText.correct },
  incorrect: { Icon: X, label: answerVerdictStatusText.incorrect },
};

const STATE_CLASSES: Record<TokenChipState, string> = {
  idle: verdictChipClass.idle,
  selected: verdictChipClass.selected,
  correct: verdictChipClass.correct,
  incorrect: verdictChipClass.incorrect,
  dragging:
    'radius-field border-selected bg-selected text-default shadow-lift opacity-90 scale-[1.02]',
  fixed:
    'radius-field cursor-default border-hovered bg-neutral-subtle text-subtle',
};

const BASE_CLASSES =
  'inline-flex cursor-pointer items-center border px-4 py-3 transition-[colors,transform,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focused)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background-neutral)]';

const GRABBABLE_CLASSES =
  "relative cursor-grab pl-8 before:absolute before:left-3 before:top-1/2 before:-translate-y-1/2 before:text-subtle/70 before:content-['::'] data-[state=dragging]:opacity-70";

export const TokenChip = ({
  text,
  state = 'idle',
  grabbable = false,
  ref,
  disabled,
  onClick,
  ...props
}: TokenChipProps) => {
  const isFixed = state === 'fixed';
  const isDisabled = Boolean(disabled) || isFixed;
  const composedClassName = cn(
    BASE_CLASSES,
    STATE_CLASSES[state],
    grabbable && GRABBABLE_CLASSES,
    isDisabled && 'pointer-events-none',
  );

  if (isFixed) {
    return (
      <Text as="span" size="large" weight="semibold">
        <span
          className={cn(BASE_CLASSES, STATE_CLASSES.fixed)}
          data-state="fixed"
          data-testid="token-chip"
        >
          <span className="min-w-0 whitespace-normal break-words">
            <Text as="span" lang="no" weight="semibold">
              {text}
            </Text>
          </span>
          <span className="sr-only">already placed</span>
        </span>
      </Text>
    );
  }

  const verdict = GRADED_VERDICT[state];

  return (
    <Text as="span" size="large" weight="semibold">
      <button
        {...props}
        type="button"
        ref={ref}
        data-state={state}
        data-testid="token-chip"
        className={composedClassName}
        style={undefined}
        disabled={isDisabled}
        onClick={onClick}
      >
        <span className="min-w-0 whitespace-normal break-words">
          <Text as="span" lang="no" weight="semibold">
            {text}
          </Text>
        </span>
        {verdict ? (
          <>
            <verdict.Icon
              aria-hidden="true"
              className="ml-1 size-3.5 shrink-0"
            />
            <span className="sr-only">{verdict.label}</span>
          </>
        ) : null}
      </button>
    </Text>
  );
};

TokenChip.displayName = 'TokenChip';
