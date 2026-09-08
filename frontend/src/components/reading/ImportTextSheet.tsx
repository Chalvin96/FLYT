import { useMemo, useState } from 'react';

import { BottomSheetDialogContent } from '@/components/common/BottomSheetDialogContent/BottomSheetDialogContent';
import { Button } from '@/components/common/Button/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCreatePasteImport } from '@/hooks/imports/queries';
import { useIsDesktop } from '@/hooks/ui/useIsDesktop';
import { getApiErrorCode } from '@/lib/apiError';
import { cn } from '@/lib/utils';
import { IMPORT_ERROR_CODES, IMPORT_TEXT_MAX_BYTES } from '@/types/api';

import {
  formatKilobytes,
  getImportTextByteCount,
  normalizeImportText,
} from './importDisplay';

function measureImportText(text: string): {
  normalizedBytes: number;
  isEmpty: boolean;
} {
  const normalized = normalizeImportText(text);
  return {
    normalizedBytes: getImportTextByteCount(normalized),
    isEmpty: normalized.length === 0,
  };
}

interface ImportTextSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportTextSheet({
  isOpen,
  onOpenChange,
}: ImportTextSheetProps) {
  const [sessionId, setSessionId] = useState(0);

  const handleOpenChange = (open: boolean) => {
    if (open) setSessionId((n) => n + 1);
    onOpenChange(open);
  };

  return (
    <ImportTextSheetInner
      key={sessionId}
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
    />
  );
}

function ImportTextSheetInner({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isDesktop = useIsDesktop();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [showQuotaDialog, setShowQuotaDialog] = useState(false);
  const createImport = useCreatePasteImport();

  const { normalizedBytes, isEmpty } = useMemo(
    () => measureImportText(text),
    [text],
  );
  const isOverSize = normalizedBytes > IMPORT_TEXT_MAX_BYTES;
  const isSubmitDisabled = isOverSize || isEmpty || createImport.isPending;

  const overByBytes = isOverSize ? normalizedBytes - IMPORT_TEXT_MAX_BYTES : 0;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    // A form submit never consults the button's disabled state.
    if (isSubmitDisabled) return;

    try {
      await createImport.mutateAsync({
        title: title.trim() ? title.trim() : undefined,
        text,
      });
      onOpenChange(false);
    } catch (error) {
      if (getApiErrorCode(error) === IMPORT_ERROR_CODES.QUOTA_EXCEEDED) {
        setShowQuotaDialog(true);
      }
    }
  }

  const counterText = isOverSize
    ? `${formatKilobytes(normalizedBytes)} / ${formatKilobytes(IMPORT_TEXT_MAX_BYTES)} — too long by ${formatKilobytes(overByBytes)}`
    : `${formatKilobytes(normalizedBytes)} / ${formatKilobytes(IMPORT_TEXT_MAX_BYTES)}`;

  const body = (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
      <div className="space-y-1">
        <DialogTitle className="type-title font-display text-foreground">
          {showQuotaDialog ? 'Import limit reached' : 'Import text'}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {showQuotaDialog
            ? 'You have reached the import limit.'
            : 'Paste Norwegian text to turn it into a tap-to-read story.'}
        </DialogDescription>
      </div>

      {showQuotaDialog ? (
        <p className="type-caption text-muted-foreground">
          You&apos;ve reached your import limit. Your existing imports stay
          available.
        </p>
      ) : (
        <>
          <p className="type-caption text-muted-foreground">
            Paste Norwegian text. We&apos;ll process it into a reader you can
            tap through.
          </p>

          <label
            htmlFor="import-title"
            className="flex items-center justify-between type-label-sm text-foreground"
          >
            <span>Title (optional)</span>
          </label>
          <input
            id="import-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            maxLength={200}
            className="radius-field h-9 w-full border border-secondary-20 bg-white-100 px-3 type-caption text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />

          <label
            htmlFor="import-text"
            className="flex items-center justify-between type-label-sm text-foreground"
          >
            <span>
              Text<span className="sr-only"> (required)</span>
            </span>
            <span
              aria-hidden="true"
              className="type-caption-sm text-muted-foreground"
            >
              required
            </span>
          </label>
          <textarea
            id="import-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste text here…"
            rows={6}
            className={cn(
              'radius-field min-h-[8rem] w-full resize-y border bg-white-100 p-3 type-caption text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isOverSize ? 'border-destructive-40' : 'border-secondary-20',
            )}
            aria-invalid={isOverSize}
            required
            aria-required="true"
          />

          <p
            className={cn(
              'type-caption-sm',
              isOverSize ? 'text-destructive-70' : 'text-muted-foreground',
            )}
            aria-live="polite"
          >
            {counterText}
          </p>
        </>
      )}

      <div className="flex justify-end gap-2 pt-1">
        {showQuotaDialog ? (
          <Button
            type="button"
            onClick={() => {
              setShowQuotaDialog(false);
              onOpenChange(false);
            }}
          >
            Got it
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createImport.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitDisabled}>
              {createImport.isPending ? 'Importing…' : 'Import'}
            </Button>
          </>
        )}
      </div>
    </form>
  );

  if (isDesktop) {
    return (
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!createImport.isPending) onOpenChange(open);
        }}
      >
        <DialogContent
          className={cn(
            // Match the bespoke dimensions the prior hand-rolled panel used so
            // the visual footprint is unchanged, but route through the Radix
            // DialogPrimitive.Content wrapper so focus is trapped and Escape
            // / outside-click dismiss properly (LookupSheet does the same).
            'left-1/2 top-1/2 max-h-[var(--sheet-max-height-tall)] w-[min(var(--dialog-desktop-max-width),calc(100%-3rem))] translate-x-[-50%] translate-y-[-50%] gap-0 overflow-y-auto p-5',
          )}
        >
          {body}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!createImport.isPending) onOpenChange(open);
      }}
    >
      <BottomSheetDialogContent
        className="flex flex-col gap-0 px-5 py-5"
        showCloseButton
      >
        {body}
      </BottomSheetDialogContent>
    </Dialog>
  );
}
