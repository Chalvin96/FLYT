import type { ClosedProps } from '../lib/closed';
import { cn } from '../lib/utils';
import { choiceTileVariants } from './choice-tile-variants';

export type ChoiceTileLayout = 'stack' | 'row' | 'inline';
export type ChoiceTileAnnounceAs = 'radio' | 'toggle';
export type ChoiceTileState = 'idle' | 'selected' | 'unavailable';

export type ChoiceTileProps = Omit<
  ClosedProps<'button'>,
  | 'type'
  | 'role'
  | 'aria-checked'
  | 'aria-pressed'
  | 'aria-disabled'
  | 'data-state'
> & {
  layout?: ChoiceTileLayout;
  selected?: boolean;
  /** `radio` needs an enclosing `role="radiogroup"`; `toggle` uses `aria-pressed`. */
  announceAs?: ChoiceTileAnnounceAs;
  /** Exists but cannot be picked yet. Stays focusable, unlike `disabled`. */
  unavailable?: boolean;
};

const ChoiceTile = ({
  announceAs = 'radio',
  children,
  layout,
  onClick,
  selected = false,
  unavailable = false,
  ...props
}: ChoiceTileProps) => {
  const state: ChoiceTileState = unavailable
    ? 'unavailable'
    : selected
      ? 'selected'
      : 'idle';

  return (
    <button
      {...props}
      className={cn(choiceTileVariants({ layout }))}
      data-state={state}
      style={undefined}
      onClick={(event) => {
        if (unavailable) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      type="button"
      {...(announceAs === 'toggle'
        ? { 'aria-pressed': selected }
        : { role: 'radio', 'aria-checked': selected })}
      {...(unavailable ? { 'aria-disabled': true } : {})}
    >
      {children}
    </button>
  );
};
ChoiceTile.displayName = 'ChoiceTile';

export { ChoiceTile };
