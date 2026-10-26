import { useMemo, useState } from "react";
import { Popover, PopoverAnchor, PopoverContent } from "@flyt/ui";

import { PopupContent } from "./PopupContent";
import {
  buildLookupKey,
  buildPopupAriaLabel,
  derivePopupState,
  type SelectionFallback,
} from "./popupView";
import { usePageImport } from "./usePageImport";
import { usePopupFocusTrap } from "./usePopupFocusTrap";
import type { LemmaContext, MsgResult } from "../lib/messages";
import type { ResolveResponse } from "../lib/resolve-types";
import type { PopupFailure } from "./buildPopupError";

export type PopupState =
  | { kind: "hidden" }
  | { kind: "loading"; word: string; context?: LemmaContext }
  | { kind: "result"; res: ResolveResponse; context?: LemmaContext }
  | { kind: "selection"; selection: LemmaContext; text?: string }
  | { kind: "signIn" }
  | {
      kind: "error";
      error?: PopupFailure["error"];
      message?: string;
      word?: string;
      context?: LemmaContext;
    };

const DEFAULT_ANCHOR_RECT = new DOMRect(0, 0);

export function Popup({
  state,
  anchorRect,
  onImportPage,
  onClose,
  sessionId = 0,
}: {
  state: PopupState;
  anchorRect?: DOMRect;
  onImportPage: () => Promise<MsgResult>;
  onClose?: () => void;
  sessionId?: number;
}) {
  const [selectionFallback, setSelectionFallback] =
    useState<SelectionFallback | null>(null);
  const currentState = derivePopupState(state, sessionId, selectionFallback);
  const { handleKeyDown, panelRef } = usePopupFocusTrap(
    currentState.kind === "hidden",
  );
  const pageImport = usePageImport(onImportPage, sessionId);
  const virtualAnchor = useMemo(
    () => ({
      current: {
        getBoundingClientRect: () => anchorRect ?? DEFAULT_ANCHOR_RECT,
      },
    }),
    [anchorRect],
  );
  if (currentState.kind === "hidden") return null;
  return (
    <Popover
      modal={false}
      onOpenChange={(open) => {
        if (!open) onClose?.();
      }}
      open
    >
      <PopoverAnchor virtualRef={virtualAnchor} />
      <PopoverContent
        align="start"
        aria-label={buildPopupAriaLabel(currentState)}
        aria-busy={currentState.kind === "loading"}
        collisionPadding={10}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onKeyDown={handleKeyDown}
        padding="none"
        ref={panelRef}
        sideOffset={6}
        tabIndex={-1}
        width="panel"
      >
        <PopupContent
          key={buildLookupKey(currentState)}
          state={currentState}
          onWordNotFound={
            currentState.kind === "selection"
              ? undefined
              : (word) =>
                  setSelectionFallback({
                    originalState: state,
                    sessionId,
                    word,
                  })
          }
          onClose={onClose}
          pageImport={pageImport}
        />
      </PopoverContent>
    </Popover>
  );
}
