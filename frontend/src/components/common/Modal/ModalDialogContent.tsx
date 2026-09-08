import * as React from 'react';

import { DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type ModalDialogContentSize = 'sm' | 'md' | 'lg' | 'xl';

const sizeClasses: Record<ModalDialogContentSize, string> = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-[var(--dialog-desktop-max-width)]',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
};

interface ModalDialogContentProps extends React.ComponentPropsWithoutRef<
  typeof DialogContent
> {
  size?: ModalDialogContentSize;
}

export function ModalDialogContent({
  size = 'md',
  className,
  ...props
}: ModalDialogContentProps) {
  return (
    <DialogContent className={cn(sizeClasses[size], className)} {...props} />
  );
}
