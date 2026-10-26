import * as TooltipPrimitive from '@radix-ui/react-tooltip';

import { createClosedRenderer, type ClosedProps } from '../lib/closed';
import { usePortalContainer } from '../lib/shadow-surface';
import { cn } from '../lib/utils';
import { TEXT_SIZE } from './text-variants';

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;

export type TooltipTriggerProps = ClosedProps<typeof TooltipPrimitive.Trigger>;

const renderTooltipTrigger = createClosedRenderer(TooltipPrimitive.Trigger);

const TooltipTrigger = (props: TooltipTriggerProps) =>
  renderTooltipTrigger(props);
TooltipTrigger.displayName = TooltipPrimitive.Trigger.displayName;

/** `narrow` wraps an explanation; `auto` hugs a short label. */
export type TooltipWidth = 'auto' | 'narrow';

export type TooltipContentProps = ClosedProps<
  typeof TooltipPrimitive.Content
> & { width?: TooltipWidth };

const TooltipContent = ({
  sideOffset = 4,
  ref,
  width = 'auto',
  ...props
}: TooltipContentProps) => {
  const portalContainer = usePortalContainer();

  return (
    <TooltipPrimitive.Portal container={portalContainer}>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        {...props}
        className={cn(
          `z-50 overflow-hidden radius-field bg-brand-bold px-3 py-1.5 ${TEXT_SIZE.xs} text-inverse animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2`,
          width === 'narrow' && `max-w-56 text-center ${TEXT_SIZE['xs-snug']}`,
        )}
        style={undefined}
      />
    </TooltipPrimitive.Portal>
  );
};
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
