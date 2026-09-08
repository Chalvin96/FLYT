import { MessageScroller as MessageScrollerPrimitive } from '@shadcn/react/message-scroller';
import { ArrowDown } from 'lucide-react';
import type * as React from 'react';

import { cn } from '@/lib/utils';

export function MessageScrollerProvider(
  props: React.ComponentProps<typeof MessageScrollerPrimitive.Provider>,
) {
  return <MessageScrollerPrimitive.Provider {...props} />;
}

export function MessageScroller({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Root>) {
  return (
    <MessageScrollerPrimitive.Root
      className={cn(
        'relative flex size-full min-h-0 flex-col overflow-hidden',
        className,
      )}
      data-slot="message-scroller"
      {...props}
    />
  );
}

export function MessageScrollerViewport({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Viewport>) {
  return (
    <MessageScrollerPrimitive.Viewport
      className={cn(
        'size-full min-h-0 min-w-0 overflow-y-auto overscroll-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        className,
      )}
      data-slot="message-scroller-viewport"
      {...props}
    />
  );
}

export function MessageScrollerContent({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Content>) {
  return (
    <MessageScrollerPrimitive.Content
      className={cn('flex h-max min-h-full flex-col gap-8', className)}
      data-slot="message-scroller-content"
      {...props}
    />
  );
}

export function MessageScrollerItem({
  className,
  scrollAnchor = false,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Item>) {
  return (
    <MessageScrollerPrimitive.Item
      className={cn('min-w-0 shrink-0', className)}
      data-slot="message-scroller-item"
      scrollAnchor={scrollAnchor}
      {...props}
    />
  );
}

export function MessageScrollerButton({
  'aria-label': ariaLabel,
  children,
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Button>) {
  return (
    <MessageScrollerPrimitive.Button
      aria-label={ariaLabel ?? 'Scroll to latest'}
      className={cn(
        'absolute right-4 bottom-4 flex size-11 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-secondary-80 shadow-soft transition-[opacity,background-color,color] hover:bg-secondary-10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[active=false]:pointer-events-none data-[active=false]:opacity-0',
        className,
      )}
      data-slot="message-scroller-button"
      {...props}
    >
      {children ?? <ArrowDown aria-hidden="true" className="icon-sm" />}
    </MessageScrollerPrimitive.Button>
  );
}
