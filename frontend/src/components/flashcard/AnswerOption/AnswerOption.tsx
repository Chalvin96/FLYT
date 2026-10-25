import { Text } from '@flyt/ui';
import { cva } from 'class-variance-authority';
import type { KeyboardEvent, ReactNode, Ref } from 'react';

import { cn } from '@/lib/utils';

import {
  answerVerdictStatusText,
  verdictTileClass,
  verdictTileMarkerClass,
  type TileVerdict,
} from '../answerVerdict';

export type AnswerOptionLayout = 'stacked' | 'inline';

const answerOptionVariants = cva(
  [
    'relative flex w-full cursor-pointer items-center border',
    'transition-[background-color,border-color,box-shadow,color] duration-150 ease-out',
    'outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focused)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background-neutral)]',
    'disabled:cursor-default',
  ],
  {
    variants: {
      layout: {
        stacked: 'radius-field gap-3 px-4 py-3 text-left whitespace-normal',
        inline:
          'h-11 w-auto justify-center gap-2 rounded-full px-4 whitespace-nowrap',
      },
    },
    defaultVariants: { layout: 'stacked' },
  },
);

export interface AnswerOptionProps {
  state: TileVerdict;
  checked: boolean;
  label: ReactNode;
  /** Letter chip before Check, result icon after. Omitted for inline chips. */
  marker?: ReactNode;
  detail?: ReactNode;
  /** Accessible name when `label` is not plain text. */
  'aria-label'?: string;
  layout?: AnswerOptionLayout;
  /** Roving tab stop owned by the group. */
  tabIndex?: number;
  disabled?: boolean;
  lang?: string;
  onClick?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void;
  ref?: Ref<HTMLButtonElement>;
}

/** Callers own the radiogroup, the roving `tabIndex`, and arrow-key movement. */
export function AnswerOption({
  checked,
  detail,
  disabled = false,
  label,
  layout = 'stacked',
  marker,
  state,
  onClick,
  onKeyDown,
  ref,
  lang,
  'aria-label': ariaLabel,
  tabIndex,
}: AnswerOptionProps) {
  const statusText =
    state === 'correct' || state === 'incorrect'
      ? answerVerdictStatusText[state]
      : undefined;
  const accessibleLabel =
    ariaLabel && statusText ? `${ariaLabel} — ${statusText}` : ariaLabel;

  return (
    <button
      aria-checked={checked}
      aria-label={accessibleLabel}
      className={cn(answerOptionVariants({ layout }), verdictTileClass[state])}
      data-checked={checked}
      data-state={state}
      data-testid="answer-option"
      disabled={disabled}
      lang={lang}
      onClick={onClick}
      onKeyDown={onKeyDown}
      ref={ref}
      role="radio"
      tabIndex={tabIndex}
      type="button"
    >
      {marker ? (
        <span
          aria-hidden="true"
          className={cn(
            'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors',
            verdictTileMarkerClass[state],
          )}
        >
          <Text as="span" size="medium" weight="bold">
            {marker}
          </Text>
        </span>
      ) : null}
      {layout === 'stacked' ? (
        <span className="flex flex-1 flex-col gap-1">
          <Text as="span" size="large" weight="semibold">
            {label}
          </Text>
          {detail ? (
            <Text as="span" size="medium">
              {detail}
            </Text>
          ) : null}
          {statusText ? <span className="sr-only"> — {statusText}</span> : null}
        </span>
      ) : (
        <>
          <Text as="span" size="large" weight="semibold">
            {label}
          </Text>
          {statusText ? <span className="sr-only"> — {statusText}</span> : null}
        </>
      )}
    </button>
  );
}
