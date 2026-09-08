import type * as React from 'react';

import { cn } from '@/lib/utils';

export function Marker({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        "group/marker relative flex min-h-4 w-full items-center gap-2 text-left type-caption-sm text-muted-foreground before:mr-1 before:h-px before:min-w-0 before:flex-1 before:bg-border before:content-[''] after:ml-1 after:h-px after:min-w-0 after:flex-1 after:bg-border after:content-['']",
        className,
      )}
      data-slot="marker"
      {...props}
    />
  );
}

export function MarkerContent({
  className,
  ...props
}: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn('min-w-0 wrap-break-word', className)}
      data-slot="marker-content"
      {...props}
    />
  );
}
