import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import * as React from 'react';

import { DialogOverlay, DialogPortal } from './dialog';
import {
  bottomSheetDialogVariants,
  type BottomSheetAnchor,
  type BottomSheetHeight,
  type BottomSheetLayout,
  type BottomSheetPadding,
} from './bottom-sheet-dialog-content-variants';

export type BottomSheetDialogContentProps = Omit<
  React.ComponentPropsWithRef<typeof DialogPrimitive.Content>,
  'className' | 'style'
> & {
  anchor?: BottomSheetAnchor;
  layout?: BottomSheetLayout;
  height?: BottomSheetHeight;
  padding?: BottomSheetPadding;
  showCloseButton?: boolean;
};

export type {
  BottomSheetAnchor,
  BottomSheetHeight,
  BottomSheetLayout,
  BottomSheetPadding,
} from './bottom-sheet-dialog-content-variants';

export const BottomSheetDialogContent = ({
  anchor,
  children,
  height,
  layout,
  padding,
  ref,
  showCloseButton = false,
  ...props
}: BottomSheetDialogContentProps) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      {...props}
      className={bottomSheetDialogVariants({ anchor, layout, height, padding })}
      style={undefined}
    >
      {children}
      {showCloseButton ? (
        <DialogPrimitive.Close className="absolute top-4 right-4 rounded-full p-1 text-subtle transition-colors hover:bg-neutral-subtle hover:text-default focus:ring-2 focus:ring-[var(--border-focused)] focus:ring-offset-2 focus:ring-offset-[var(--background-neutral)] focus:outline-none">
          <X className="icon-sm" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      ) : null}
    </DialogPrimitive.Content>
  </DialogPortal>
);

BottomSheetDialogContent.displayName = 'BottomSheetDialogContent';
