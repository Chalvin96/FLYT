import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * TokenChip
 *
 * The single draggable/tappable word-pill used across Operation-family
 * exercises (Order, Match, Categorize, RecallFill, Build, FindFix).
 *
 * It is strictly presentational and state-driven: it renders whatever
 * visual state the parent passes in and forwards button events. It owns
 * no dnd-kit logic — callers compose it inside useSortable / useDraggable.
 *
 * Styling is built on the existing design system: Badge's base class
 * foundation (`inline-flex items-center radius-sm border ... type-caption-sm
 * font-semibold transition-colors`) plus the same colour tokens already
 * used by WordFormChip, Build.tsx and OperationShell (bg-card, bg-primary-5,
 * border-primary-60, border-destructive-40, etc.). No new tokens invented.
 */

export type TokenChipState =
  'idle' | 'selected' | 'dragging' | 'correct' | 'wrong' | 'fixed';

export interface TokenChipProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'ref'
> {
  /** Word or phrase displayed inside the chip. */
  text: string;
  /** Visual + interactive state. Defaults to 'idle'. */
  state?: TokenChipState;
  /**
   * Optional override for the word element. Used by dnd-kit to spread
   * draggable attributes / listeners / setNodeRef onto the chip.
   * Falls back to the local button ref otherwise.
   */
  ref?: React.Ref<HTMLButtonElement>;
}

/**
 * State -> className mapping. Every class here reuses an existing design
 * token; see the per-state comments for the visual intent.
 *
 * v3 three-plane depth: resting tiles carry `shadow-tile` (raised on the
 * mat); `dragging` switches to `shadow-lift` (picked up).
 *
 * - idle:      resting chip (border-border, bg-card, shadow-tile)
 * - selected:  armed / pressed (border-primary-60, bg-primary-5, shadow-tile)
 * - dragging:  elevated mid-drag (shadow-lift + slight lift)
 * - correct:   right answer (green via primary tokens, like Build.tsx)
 * - wrong:     destructive answer (red via destructive tokens)
 * - fixed:     muted, non-interactive placeholder
 */
const STATE_CLASSES: Record<TokenChipState, string> = {
  idle: 'radius-field border-border bg-card text-foreground shadow-tile',
  selected:
    'radius-field border-primary-60 bg-primary-5 text-foreground shadow-tile',
  dragging:
    'radius-field border-primary-60 bg-primary-5 text-foreground shadow-lift opacity-90 scale-[1.02]',
  correct:
    'radius-field border-primary-30 bg-primary-5 text-primary-90 shadow-tile',
  wrong:
    'radius-field border-destructive-40 bg-destructive-10 text-destructive-90 shadow-tile',
  fixed:
    'radius-field border-border bg-secondary-10 text-muted-foreground cursor-default',
};

/**
 * Badge's base class foundation (kept in sync with
 * `@/components/ui/badge`). Inlined here so the chip can render as a real
 * `<button>` (semantic + natively focusable) instead of a div.
 */
const BASE_CLASSES =
  'type-body inline-flex cursor-pointer items-center border px-4 py-3 font-semibold transition-[colors,transform,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

export const draggableTokenChipClassName =
  "relative cursor-grab pl-8 before:absolute before:left-3 before:top-1/2 before:-translate-y-1/2 before:text-muted-foreground/70 before:content-['::'] data-[state=dragging]:opacity-70";

export const TokenChip = ({
  text,
  state = 'idle',
  className,
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
    isDisabled && 'pointer-events-none',
    className,
  );

  if (isFixed) {
    // Fixed chips are static text — render as a muted, non-interactive span
    // so they cannot be tabbed to or clicked.
    return (
      <span
        className={cn(BASE_CLASSES, STATE_CLASSES.fixed, className)}
        data-state="fixed"
        data-testid="token-chip"
      >
        <span
          lang="no"
          className="min-w-0 whitespace-normal break-words font-medium"
        >
          {text}
        </span>
      </span>
    );
  }

  return (
    <button
      type="button"
      ref={ref}
      data-state={state}
      data-testid="token-chip"
      className={composedClassName}
      disabled={isDisabled}
      onClick={onClick}
      {...props}
    >
      <span
        lang="no"
        className="min-w-0 whitespace-normal break-words font-medium"
      >
        {text}
      </span>
    </button>
  );
};

TokenChip.displayName = 'TokenChip';
