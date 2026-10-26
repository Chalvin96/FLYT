import { Button, Text } from "@flyt/ui";
import { BookOpen } from "lucide-react";

import { ImportSaved } from "./ImportSaved";
import { ErrorActions, ErrorMessage } from "./PopupError";
import type { ImportStatus } from "./usePageImport";

const APP_ORIGIN = (
  import.meta.env.VITE_APP_ORIGIN ?? "http://localhost:5173"
).replace(/\/$/, "");

export function ImportAction({
  status,
  onImportPage,
  title,
}: {
  status: ImportStatus;
  onImportPage: () => void;
  title: string;
}) {
  if (status.kind === "error") {
    return (
      <div className="shrink-0 bg-neutral-subtle">
        <ErrorMessage failure={status.failure} />
        <ErrorActions failure={status.failure} onRetry={onImportPage} />
      </div>
    );
  }
  return (
    <div className="shrink-0 bg-neutral-subtle px-4 py-2">
      {status.kind === "success" ? (
        <div role="status">
          <ImportSaved importsUrl={`${APP_ORIGIN}/reading/imports`} />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <BookOpen
              aria-hidden="true"
              className="size-4 shrink-0 text-icon-default"
            />
            <div className="min-w-0 flex-1 truncate" title={title}>
              <Text as="span" size="small" tone="subtle">
                {title}
              </Text>
            </div>
            <Button
              size="sm"
              variant="ghost"
              disabled={status.kind === "importing"}
              onClick={onImportPage}
            >
              {status.kind === "importing"
                ? "Saving this page…"
                : "Import page"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
