import { createShadowSurface } from "@flyt/ui";
import { createPortal } from "react-dom";
import { useCallback, useMemo } from "react";
import type { ComponentType } from "react";

import { shadowCss } from "../lib/shadowSheet";

import "./storyHost.css";

export function ShadowSurfaceMount({
  Story,
  whitePage = false,
}: {
  Story: ComponentType;
  whitePage?: boolean;
}) {
  const surface = useMemo(() => {
    const surface = createShadowSurface(shadowCss, { mode: "open" });
    surface.container.dataset.testid = "extension-shadow-host";
    return surface;
  }, []);
  const PortalSurface = surface.PortalSurface;
  const attachSurface = useCallback(
    (mountPoint: HTMLDivElement | null) => {
      mountPoint?.append(surface.container);
    },
    [surface],
  );

  return (
    <div data-visual-host={whitePage || undefined} ref={attachSurface}>
      {createPortal(
        <PortalSurface>
          <Story />
        </PortalSurface>,
        surface.reactHost,
      )}
    </div>
  );
}
