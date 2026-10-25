import {
  BottomSheetDialogContent,
  Button,
  Dialog,
  DialogDescription,
  DialogTitle,
} from '@flyt/ui';
import { X } from 'lucide-react';
import type { RefObject } from 'react';

import { useIsDesktop } from '@/hooks/ui/useIsDesktop';

export function ReaderLookupSheet({
  open,
  title,
  onClose,
  returnFocusRef,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLElement | null>;
  children: React.ReactNode;
}) {
  const isDesktop = useIsDesktop();
  if (isDesktop) return null;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <BottomSheetDialogContent
        anchor="edge"
        layout="column"
        height="tall"
        padding="none"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusRef.current?.focus();
        }}
      >
        <div
          aria-hidden
          className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-neutral-bold"
        />
        <div className="flex shrink-0 justify-end px-3 pt-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close word lookup"
            onClick={onClose}
          >
            <X aria-hidden />
          </Button>
        </div>
        <DialogTitle visuallyHidden>{title}</DialogTitle>
        <DialogDescription visuallyHidden>
          Look up words from the current story page.
        </DialogDescription>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </BottomSheetDialogContent>
    </Dialog>
  );
}
