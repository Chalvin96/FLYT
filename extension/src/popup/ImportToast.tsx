import { Button, Card, Text } from "@flyt/ui";

import type { ImportActionStatus } from "../lib/importMessage";
import { ImportFooter, ImportSaved } from "./ImportSaved";

// Non-modal status toast for a context-menu "Import this page". Unlike the
// lookup popup this is passive (role=status, no focus trap): the menu click is
// the trigger, so there is no import button — only importing / success / error,
// plus an explicit dismiss (dismissing on any click would eat the success link).
export function ImportToast({
  status,
  importsUrl,
  onClose,
}: {
  status: ImportActionStatus;
  importsUrl: string;
  onClose: () => void;
}) {
  return (
    <Card
      aria-live="polite"
      clipContent
      elevation="raised"
      padding="none"
      role="status"
    >
      <div className="flex flex-none items-center gap-2 border-b border-default px-3.5 py-3">
        <div className="grid h-7 w-7 place-items-center radius-field bg-brand-bold italic text-inverse shadow-[var(--shadow-tile)]">
          <Text as="span" font="serif" size="medium" weight="bold">
            F
          </Text>
        </div>
        <Text as="span" size="medium" tone="default" weight="semibold">
          Flyt
        </Text>
        <span className="ml-auto flex">
          <Button
            aria-label="Dismiss"
            onClick={onClose}
            size="icon-sm"
            variant="ghost"
          >
            ×
          </Button>
        </span>
      </div>
      <ImportFooter>
        {status.kind === "importing" && (
          <Text as="p" size="medium" tone="default" weight="semibold">
            Saving this page…
          </Text>
        )}
        {status.kind === "success" && <ImportSaved importsUrl={importsUrl} />}
        {status.kind === "error" && (
          <div className="mt-2 text-danger">
            <Text as="p" size="small">
              {status.message}
            </Text>
          </div>
        )}
      </ImportFooter>
    </Card>
  );
}
