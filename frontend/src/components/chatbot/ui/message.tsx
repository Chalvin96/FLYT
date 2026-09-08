import type * as React from 'react';

import { cn } from '@/lib/utils';

export function Message({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('group/message relative w-full min-w-0', className)}
      data-slot="message"
      {...props}
    />
  );
}

export function MessageAvatar({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted',
        className,
      )}
      data-slot="message-avatar"
      {...props}
    />
  );
}

export function MessageContent({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col gap-2.5 wrap-break-word',
        className,
      )}
      data-slot="message-content"
      {...props}
    />
  );
}

export function MessageHeader({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex max-w-full min-w-0 items-center px-3 type-label-sm font-medium text-muted-foreground',
        className,
      )}
      data-slot="message-header"
      {...props}
    />
  );
}
