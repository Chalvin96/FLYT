import { Button } from "@flyt/ui";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import type { MsgResult } from "../lib/messages";
import {
  SOURCE_SENTENCE,
  SOURCE_TITLE,
  resolveStubbedMessage,
} from "../storybook/popupFixtures";
import { withChrome } from "../storybook/withChrome";
import { type PopupHandle, mountPopup } from "./mountShadow";
import { resetOverlay } from "./overlay";

type Placement = "mid" | "bottom";

function anchorRect(placement: Placement): DOMRect {
  return placement === "bottom"
    ? new DOMRect(180, window.innerHeight - 64, 60, 24)
    : new DOMRect(180, 320, 60, 24);
}

function PopupComposition({ placement }: { placement: Placement }) {
  const handleRef = useRef<PopupHandle | null>(null);

  useEffect(() => {
    handleRef.current = mountPopup(async (): Promise<MsgResult> => ({
      ok: false,
      error: "network",
    }));
    return () => {
      handleRef.current = null;
      resetOverlay();
    };
  }, []);

  return createPortal(
    <>
      <p id="popover-host-copy">Jeg leser en bok hver dag.</p>
      <Button
        id="popover-host-open"
        onClick={() =>
          handleRef.current?.showSelection(
            { source_sentence: SOURCE_SENTENCE, source_title: SOURCE_TITLE },
            anchorRect(placement),
            SOURCE_SENTENCE,
          )
        }
        size="sm"
        type="button"
      >
        Open popup
      </Button>
    </>,
    document.body,
  );
}

const meta = {
  title: "Features/Extension/Popup composition",
  component: PopupComposition,
  decorators: [withChrome(resolveStubbedMessage)],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PopupComposition>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Mid: Story = { args: { placement: "mid" } };
export const Bottom: Story = { args: { placement: "bottom" } };
