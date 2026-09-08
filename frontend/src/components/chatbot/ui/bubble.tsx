import type * as React from 'react';

import { cn } from '@/lib/utils';

export function Bubble({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'relative flex w-fit max-w-full min-w-0 flex-col gap-1',
        className,
      )}
      data-slot="bubble"
      {...props}
    />
  );
}

export function BubbleContent({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'w-fit max-w-full min-w-0 overflow-hidden wrap-break-word',
        className,
      )}
      data-slot="bubble-content"
      {...props}
    />
  );
}
