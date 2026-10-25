import type { ClosedProps } from '../lib/closed';
import { cn } from '../lib/utils';
import { inputVariants } from './input-variants';

export type InputSize = 'md' | 'lg';
export type InputPresentation = 'default' | 'quiet' | 'solid';
export type InputAdornments = 'none' | 'leading' | 'both';

export type InputProps = Omit<ClosedProps<'input'>, 'size'> & {
  size?: InputSize;
  /** `quiet` displays rather than accepts: read-only, no shadow, no focus ring. */
  presentation?: InputPresentation;
  /** Reserves room for a leading icon, and for a trailing control. */
  adornments?: InputAdornments;
};

const Input = ({
  adornments,
  presentation,
  readOnly,
  size,
  type,
  ...props
}: InputProps) => (
  <input
    {...props}
    className={cn(inputVariants({ size, presentation, adornments }))}
    readOnly={presentation === 'quiet' || readOnly}
    style={undefined}
    type={type}
  />
);
Input.displayName = 'Input';

export { Input };
