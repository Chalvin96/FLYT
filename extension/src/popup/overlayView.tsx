import { useSyncExternalStore } from "react";

import { Button, type ShadowSurface } from "@flyt/ui";
import { ImportToast } from "./ImportToast";
import { Popup } from "./Popup";
import { FlytMark } from "./FlytMark";
import {
  dismissToast,
  getOverlaySnapshot,
  hidePopup,
  popupImportPage,
  subscribeOverlay,
} from "./overlay";

export function SelectionIconView({
  position,
  onActivate,
}: {
  position: { top: string; left: string } | null;
  onActivate: () => void;
}) {
  return (
    <div className="absolute" hidden={!position} style={position ?? undefined}>
      <Button
        aria-label="Look up with Flyt"
        onClick={onActivate}
        onMouseDown={(event) => event.preventDefault()}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <FlytMark />
      </Button>
    </div>
  );
}

export function OverlayView({
  portal,
}: {
  portal: ShadowSurface["PortalSurface"];
}) {
  const { popup, toast, icon } = useSyncExternalStore(
    subscribeOverlay,
    getOverlaySnapshot,
  );
  const Portal = portal;
  const popupPanel =
    popup.state.kind !== "hidden" ? (
      <Popup
        anchorRect={popup.anchorRect ?? undefined}
        onClose={hidePopup}
        onImportPage={popupImportPage}
        sessionId={popup.sessionId}
        state={popup.state}
      />
    ) : null;
  return (
    <>
      <SelectionIconView onActivate={icon.activate} position={icon.position} />
      {popupPanel ? <Portal>{popupPanel}</Portal> : null}
      {toast.status.kind !== "idle" ? (
        <div className="fixed right-4 bottom-4">
          <ImportToast
            importsUrl={toast.importsUrl}
            onClose={() => dismissToast(toast.generation)}
            status={toast.status}
          />
        </div>
      ) : null}
    </>
  );
}
