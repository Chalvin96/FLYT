import { Text } from '@flyt/ui';
import type * as React from 'react';

import { cn } from '@/lib/utils';

export function Marker({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'group/marker relative flex min-h-4 w-full items-center gap-2 text-left',
        "before:mr-1 before:h-px before:min-w-0 before:flex-1 before:bg-neutral-pressed before:content-[''] after:ml-1 after:h-px after:min-w-0 after:flex-1 after:bg-neutral-pressed after:content-['']",
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
    >
      <Text as="span" size="small" tone="subtle">
        {props.children}
      </Text>
    </span>
  );
}
