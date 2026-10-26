import { X } from 'lucide-react';

import type { ClosedProps } from '../lib/closed';
import { cn } from '../lib/utils';
import { chipVariants } from './chip-variants';

export type ChipVariant = 'filter' | 'suggestion';
export type ChipState = 'idle' | 'pressed';

type ChipBaseProps = Omit<
  ClosedProps<'button'>,
  'type' | 'aria-pressed' | 'data-state'
> & {
  /** Appends a remove glyph; the accessible name must describe the removal. */
  removable?: boolean;
};

export type ChipProps =
  | (ChipBaseProps & {
      variant?: 'filter';
      /** Makes the chip a toggle. Omit so one-shot chips are not announced as one. */
      pressed?: boolean;
    })
  | (ChipBaseProps & { variant: 'suggestion'; pressed?: never });

const Chip = ({ children, removable = false, variant, ...rest }: ChipProps) => {
  const { pressed, ...props } = rest as ChipBaseProps & { pressed?: boolean };
  return (
    <button
      {...props}
      className={cn(chipVariants({ variant }))}
      style={undefined}
      type="button"
      {...(pressed === undefined
        ? {}
        : {
            'aria-pressed': pressed,
            'data-state': pressed ? 'pressed' : 'idle',
          })}
    >
      <span className="min-w-0 truncate">{children}</span>
      {removable ? <X aria-hidden="true" /> : null}
    </button>
  );
};
Chip.displayName = 'Chip';

export { Chip };
