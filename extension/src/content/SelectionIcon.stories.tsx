import type { Meta, StoryObj } from "@storybook/react";
import { expect } from "storybook/test";

import { SelectionIconView } from "../popup/overlayView";
import { getSelectionIconPosition } from "./selectionIconPosition";
import { ShadowSurfaceMount } from "../storybook/withShadowSurface";
import {
  withShadowRootPlay,
  withinShadowRoot,
} from "../storybook/shadowSurfacePlay";

function SelectionIconAt({ selection }: { selection: DOMRect }) {
  return (
    <SelectionIconView
      onActivate={() => {}}
      position={getSelectionIconPosition(selection)}
    />
  );
}

function belowSelectionRect() {
  return new DOMRect(180, 180, 60, 24);
}

function viewportBottomSelectionRect() {
  return new DOMRect(180, window.innerHeight - 24, 60, 24);
}

const meta = {
  title: "Features/Extension/Selection icon",
  component: SelectionIconView,
  decorators: [(Story) => <ShadowSurfaceMount Story={Story} />],
  parameters: { layout: "fullscreen" },
  args: { position: null, onActivate: () => {} },
} satisfies Meta<typeof SelectionIconView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BelowSelection: Story = {
  render: () => <SelectionIconAt selection={belowSelectionRect()} />,
  play: withShadowRootPlay(async (shadowRoot) => {
    const icon = withinShadowRoot(shadowRoot).getByRole("button", {
      name: "Look up with Flyt",
    });
    const selection = belowSelectionRect();
    const slot = icon.parentElement;

    await expect(icon).toBeVisible();
    await expect(slot).not.toBeNull();
    await expect(
      Number.parseFloat(slot?.style.top ?? ""),
    ).toBeGreaterThanOrEqual(window.scrollY + selection.bottom);
  }),
};

export const AboveSelectionAtViewportBottom: Story = {
  render: () => <SelectionIconAt selection={viewportBottomSelectionRect()} />,
  play: withShadowRootPlay(async (shadowRoot) => {
    const icon = withinShadowRoot(shadowRoot).getByRole("button", {
      name: "Look up with Flyt",
    });
    const selection = viewportBottomSelectionRect();
    const slot = icon.parentElement;

    await expect(icon).toBeVisible();
    await expect(slot).not.toBeNull();
    await expect(
      Number.parseFloat(slot?.style.top ?? "") +
        icon.getBoundingClientRect().height,
    ).toBeLessThanOrEqual(window.scrollY + selection.top);
  }),
};
