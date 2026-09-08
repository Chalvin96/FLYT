import type { ReactNode } from 'react';

import { SessionControl } from '@/components/common/SessionControl/SessionControl';
import { cn } from '@/lib/utils';

interface FlashcardActionFooterProps {
  className?: string;
  children: ReactNode;
}

interface FlashcardActionSplitProps {
  className?: string;
  children: ReactNode;
}

interface FlashcardActionStackProps {
  className?: string;
  children: ReactNode;
}

interface FlashcardActionFeedbackProps {
  tone?: 'default' | 'success' | 'destructive';
  className?: string;
  children: ReactNode;
}

export function FlashcardActionFooter({
  className,
  children,
}: FlashcardActionFooterProps) {
  return (
    <SessionControl className={cn('mx-auto', className)}>
      {children}
    </SessionControl>
  );
}

export function FlashcardActionSplit({
  className,
  children,
}: FlashcardActionSplitProps) {
  return (
    <div className={cn('flex w-full flex-col gap-2 sm:flex-row', className)}>
      {children}
    </div>
  );
}

export function FlashcardActionStack({
  className,
  children,
}: FlashcardActionStackProps) {
  return (
    <div className={cn('flex w-full flex-col items-center gap-2', className)}>
      {children}
    </div>
  );
}

export function FlashcardActionFeedback({
  tone = 'default',
  className,
  children,
}: FlashcardActionFeedbackProps) {
  return (
    <p
      className={cn(
        'type-caption',
        tone === 'success' && 'text-accent-80',
        tone === 'destructive' && 'text-destructive',
        tone === 'default' && 'text-muted-foreground',
        className,
      )}
    >
      {children}
    </p>
  );
}

export type {
  FlashcardActionFeedbackProps,
  FlashcardActionFooterProps,
  FlashcardActionSplitProps,
  FlashcardActionStackProps,
};
