import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface SessionControlProps {
  children: ReactNode;
  className?: string;
}

export function SessionControl({ children, className }: SessionControlProps) {
  return <div className={cn('w-full max-w-72', className)}>{children}</div>;
}

SessionControl.displayName = 'SessionControl';
