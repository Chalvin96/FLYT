import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import * as React from 'react';

import { DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export type BottomSheetDialogContentProps = React.ComponentPropsWithRef<
  typeof DialogPrimitive.Content
> & {
  showCloseButton?: boolean;
};

export const BottomSheetDialogContent = ({
  children,
  className,
  ref,
  showCloseButton = false,
  ...props
}: BottomSheetDialogContentProps) => (
  <DialogPortal>
    <DialogOverlay className="bg-black-80" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed right-4 bottom-4 left-4 z-50 grid max-h-[var(--sheet-max-height-default)] gap-0 overflow-hidden radius-section border border-border bg-card text-card-foreground shadow-lg outline-none duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom-10 data-[state=open]:slide-in-from-bottom-10 sm:right-6 sm:bottom-6 sm:left-6',
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton ? (
        <DialogPrimitive.Close className="absolute top-4 right-4 rounded-full p-1 text-muted-foreground transition-colors hover:bg-secondary-10 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background">
          <X className="icon-sm" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      ) : null}
    </DialogPrimitive.Content>
  </DialogPortal>
);

BottomSheetDialogContent.displayName = 'BottomSheetDialogContent';
