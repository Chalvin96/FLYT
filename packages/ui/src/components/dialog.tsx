import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import { createClosedRenderer, type ClosedProps } from '../lib/closed';
import { cn } from '../lib/utils';
import { TEXT_SIZE, TEXT_TONE, TEXT_WEIGHT } from './text-variants';

const Dialog = DialogPrimitive.Root;

const DialogPortal = DialogPrimitive.Portal;

export type DialogTriggerProps = ClosedProps<typeof DialogPrimitive.Trigger>;

const renderDialogTrigger = createClosedRenderer(DialogPrimitive.Trigger);

const DialogTrigger = (props: DialogTriggerProps) => renderDialogTrigger(props);
DialogTrigger.displayName = DialogPrimitive.Trigger.displayName;

export type DialogCloseProps = ClosedProps<typeof DialogPrimitive.Close>;

const renderDialogClose = createClosedRenderer(DialogPrimitive.Close);

const DialogClose = (props: DialogCloseProps) => renderDialogClose(props);
DialogClose.displayName = DialogPrimitive.Close.displayName;

export type DialogOverlayPresentation = 'scrim' | 'clear';

export type DialogOverlayProps = ClosedProps<typeof DialogPrimitive.Overlay> & {
  presentation?: DialogOverlayPresentation;
  /** Hides the scrim from `lg` up, where the surface is not a modal. */
  mobileOnly?: boolean;
};

const DIALOG_OVERLAY_PRESENTATION: Record<DialogOverlayPresentation, string> = {
  scrim: 'bg-blanket',
  clear: 'bg-transparent',
};

const DialogOverlay = ({
  mobileOnly = false,
  presentation = 'scrim',
  ref,
  ...props
}: DialogOverlayProps) => (
  <DialogPrimitive.Overlay
    ref={ref}
    {...props}
    className={cn(
      'fixed inset-0 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      DIALOG_OVERLAY_PRESENTATION[presentation],
      mobileOnly && 'lg:hidden',
    )}
    style={undefined}
  />
);
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

export type DialogVariant = 'modal' | 'sheet' | 'anchored' | 'fullscreen';
export type DialogPadding = 'compact' | 'default' | 'none';

const DIALOG_PADDING: Record<DialogPadding, string> = {
  compact: 'gap-0 p-5',
  default: 'gap-4 p-6',
  none: '',
};

const DIALOG_SURFACE =
  'z-50 outline-none duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0';

const DIALOG_VARIANT: Record<DialogVariant, string> = {
  modal:
    'fixed left-[50%] top-[50%] grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] border bg-neutral shadow-lg data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:radius-field sm:max-w-[var(--dialog-desktop-max-width)]',
  sheet:
    'fixed left-[50%] top-[50%] grid max-w-lg translate-x-[-50%] translate-y-[-50%] border bg-neutral shadow-lg data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:radius-field max-h-[var(--sheet-max-height-tall)] w-[min(var(--dialog-desktop-max-width),calc(100%-3rem))] overflow-y-auto',
  anchored:
    'radius-field fixed left-1/2 top-20 max-h-[var(--sheet-max-height-tall)] w-[min(var(--dialog-desktop-max-width),calc(100%-3rem))] -translate-x-1/2 overflow-hidden border border-default bg-raised text-default shadow-lg data-[state=open]:slide-in-from-top-4 data-[state=closed]:slide-out-to-top-4',
  fullscreen: 'fixed inset-0 flex h-dvh min-h-0 w-full flex-col bg-neutral',
};

export type DialogContentProps = ClosedProps<typeof DialogPrimitive.Content> & {
  variant?: DialogVariant;
  padding?: DialogPadding;
  overlayPresentation?: DialogOverlayPresentation;
  /** Confines the dialog and its scrim to below `lg`, where the surface is modal. */
  mobileOnly?: boolean;
  showClose?: boolean;
};

const DialogContent = ({
  children,
  mobileOnly = false,
  overlayPresentation = 'scrim',
  padding = 'default',
  ref,
  showClose = true,
  variant = 'modal',
  ...props
}: DialogContentProps) => (
  <DialogPortal>
    <DialogOverlay mobileOnly={mobileOnly} presentation={overlayPresentation} />
    <DialogPrimitive.Content
      ref={ref}
      {...props}
      className={cn(
        DIALOG_SURFACE,
        DIALOG_VARIANT[variant],
        DIALOG_PADDING[padding],
        mobileOnly && 'lg:hidden',
      )}
      style={undefined}
    >
      {children}
      {showClose ? (
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-[var(--background-neutral)] transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--border-focused)] focus:ring-offset-2 disabled:pointer-events-none">
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      ) : null}
    </DialogPrimitive.Content>
  </DialogPortal>
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = (props: ClosedProps<'div'>) => (
  <div
    {...props}
    className="flex flex-col space-y-1.5 text-center sm:text-left"
    style={undefined}
  />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = (props: ClosedProps<'div'>) => (
  <div
    {...props}
    className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2"
    style={undefined}
  />
);
DialogFooter.displayName = 'DialogFooter';

export type DialogTitleSize = 'default' | 'section' | 'title';

/** `visuallyHidden` hides a title that assistive technology needs but the dialog does not show. */
export type DialogTitleProps = ClosedProps<typeof DialogPrimitive.Title> & {
  size?: DialogTitleSize;
  visuallyHidden?: boolean;
};

const DIALOG_TITLE_SIZE: Record<DialogTitleSize, string> = {
  default: `${TEXT_SIZE['lg-none']} ${TEXT_WEIGHT.semibold} tracking-tight`,
  section: `${TEXT_SIZE.lg} ${TEXT_WEIGHT.semibold} ${TEXT_TONE.default}`,
  title: `${TEXT_SIZE['2xl']} ${TEXT_TONE.default}`,
};

const DialogTitle = ({
  ref,
  size = 'default',
  visuallyHidden = false,
  ...props
}: DialogTitleProps) => (
  <DialogPrimitive.Title
    ref={ref}
    {...props}
    className={cn(DIALOG_TITLE_SIZE[size], visuallyHidden && 'sr-only')}
    style={undefined}
  />
);
DialogTitle.displayName = DialogPrimitive.Title.displayName;

export type DialogDescriptionProps = ClosedProps<
  typeof DialogPrimitive.Description
> & { visuallyHidden?: boolean };

const DialogDescription = ({
  ref,
  visuallyHidden = false,
  ...props
}: DialogDescriptionProps) => (
  <DialogPrimitive.Description
    ref={ref}
    {...props}
    className={cn(
      `${TEXT_SIZE.sm} ${TEXT_TONE.subtle}`,
      visuallyHidden && 'sr-only',
    )}
    style={undefined}
  />
);
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
