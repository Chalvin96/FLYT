import type { ClosedProps } from '../lib/closed';
import { cn } from '../lib/utils';
import { inlineTriggerVariants } from './inline-trigger-variants';

export type InlineTriggerProps = Omit<ClosedProps<'button'>, 'type'> & {
  /** The token the surface is currently acting on. */
  current?: boolean;
};

const InlineTrigger = ({ current, ...props }: InlineTriggerProps) => (
  <button
    {...props}
    {...(current ? { 'aria-current': 'true' as const } : {})}
    data-state={current ? 'current' : 'idle'}
    className={cn(inlineTriggerVariants({ current }))}
    style={undefined}
    type="button"
  />
);
InlineTrigger.displayName = 'InlineTrigger';

export { InlineTrigger };
