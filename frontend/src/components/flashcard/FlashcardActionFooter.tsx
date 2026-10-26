import type { ReactNode } from 'react';

import { SessionControl } from '@/components/common/SessionControl/SessionControl';
import { cn } from '@/lib/utils';

export function FlashcardActionFooter({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <SessionControl className={cn('mx-auto', className)}>
      {children}
    </SessionControl>
  );
}
