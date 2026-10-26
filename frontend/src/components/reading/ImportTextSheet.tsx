import {
  BottomSheetDialogContent,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Heading,
  Text,
  textVariants,
} from '@flyt/ui';
import { useMemo, useState } from 'react';

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
        <DialogTitle size="title">
          {showQuotaDialog ? 'Import limit reached' : 'Import text'}
        </DialogTitle>
        <DialogDescription visuallyHidden>
          {showQuotaDialog
            ? 'You have reached the import limit.'
            : 'Paste Norwegian text to turn it into a tap-to-read story.'}
        </DialogDescription>
      </div>

      {showQuotaDialog ? (
        <Text as="p" size="medium" tone="subtle">
          You&apos;ve reached your import limit. Your existing imports stay
          available.
        </Text>
      ) : (
        <>
          <Text as="p" size="medium" tone="subtle">
            Paste Norwegian text. We&apos;ll process it into a reader you can
            tap through.
          </Text>

          <label
            htmlFor="import-title"
            className="flex items-center justify-between"
          >
            <Heading as="span" size="xxsmall" tone="default">
              Title (optional)
            </Heading>
          </label>
          <input
            id="import-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            maxLength={200}
            className={`radius-field h-9 w-full border border-default bg-overlay px-3 ${textVariants({ size: 'medium', tone: 'default' })} placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focused)]`}
          />

          <label
            htmlFor="import-text"
            className="flex items-center justify-between"
          >
            <Heading as="span" size="xxsmall" tone="default">
              Text<span className="sr-only"> (required)</span>
            </Heading>
            <Text as="span" size="small" tone="subtle" aria-hidden="true">
              required
            </Text>
          </label>
          <textarea
            id="import-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste text here…"
            rows={6}
            className={cn(
              'radius-field min-h-[8rem] w-full resize-y border bg-overlay p-3',
              textVariants({ size: 'medium', tone: 'default' }),
              'placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focused)]',
              isOverSize ? 'border-danger-subtle' : 'border-default',
            )}
            aria-invalid={isOverSize}
            required
            aria-required="true"
          />

          <div className={cn(isOverSize ? 'text-danger' : 'text-subtle')}>
            <Text as="p" aria-live="polite" size="small">
              {counterText}
            </Text>
          </div>
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
        <DialogContent padding="compact" variant="sheet">
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
      <BottomSheetDialogContent layout="column" padding="roomy" showCloseButton>
        {body}
      </BottomSheetDialogContent>
    </Dialog>
  );
}
