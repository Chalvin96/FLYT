'use client';

import * as PopoverPrimitive from '@radix-ui/react-popover';

import { createClosedRenderer, type ClosedProps } from '../lib/closed';
import { usePortalContainer } from '../lib/shadow-surface';
import { cn } from '../lib/utils';

const Popover = PopoverPrimitive.Root;

export type PopoverTriggerProps = ClosedProps<typeof PopoverPrimitive.Trigger>;

const renderPopoverTrigger = createClosedRenderer(PopoverPrimitive.Trigger);

const PopoverTrigger = (props: PopoverTriggerProps) =>
  renderPopoverTrigger(props);
PopoverTrigger.displayName = PopoverPrimitive.Trigger.displayName;

export type PopoverAnchorProps = ClosedProps<typeof PopoverPrimitive.Anchor>;

const renderPopoverAnchor = createClosedRenderer(PopoverPrimitive.Anchor);

const PopoverAnchor = (props: PopoverAnchorProps) => renderPopoverAnchor(props);
PopoverAnchor.displayName = PopoverPrimitive.Anchor.displayName;

export type PopoverWidth = 'default' | 'trigger' | 'compact' | 'panel';
export type PopoverPadding = 'none' | 'compact' | 'default';
export type PopoverLayer = 'default' | 'overlay';

const POPOVER_WIDTH: Record<PopoverWidth, string> = {
  default: 'w-72',
  trigger: 'w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)]',
  compact: 'w-[min(18rem,calc(100vw-24px))] max-w-[calc(100vw-24px)]',
  panel: 'w-[min(440px,calc(100vw-20px))] max-[360px]:w-[calc(100vw-12px)]',
};

const POPOVER_PADDING: Record<PopoverPadding, string> = {
  none: 'p-0',
  compact: 'p-1.5',
  default: 'p-4',
};

export type PopoverContentProps = ClosedProps<
  typeof PopoverPrimitive.Content
> & {
  width?: PopoverWidth;
  padding?: PopoverPadding;
  /** `overlay` sits above surfaces that already own the top layer, like chat. */
  layer?: PopoverLayer;
  scroll?: boolean;
};

const PopoverContent = ({
  align = 'center',
  layer = 'default',
  padding = 'default',
  ref,
  scroll = false,
  sideOffset = 4,
  width = 'default',
  ...props
}: PopoverContentProps) => {
  const portalContainer = usePortalContainer();

  return (
    <PopoverPrimitive.Portal container={portalContainer}>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        {...props}
        className={cn(
          'z-50 rounded-md border bg-overlay text-default shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-popover-content-transform-origin]',
          POPOVER_WIDTH[width],
          POPOVER_PADDING[padding],
          layer === 'overlay' && 'z-[60]',
          scroll && 'max-h-[calc(100dvh-2rem)] overflow-y-auto',
        )}
        style={undefined}
      />
    </PopoverPrimitive.Portal>
  );
};
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
