import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent } from "storybook/test";

import { SelectionIconView } from "./overlayView";
import { ShadowSurfaceMount } from "../storybook/withShadowSurface";
import {
  withShadowRootPlay,
  withinShadowRoot,
} from "../storybook/shadowSurfacePlay";

const activate = fn();
const meta = {
  title: "Features/Extension/Selection mark",
  component: SelectionIconView,
  decorators: [(Story) => <ShadowSurfaceMount Story={Story} whitePage />],
  parameters: { layout: "fullscreen" },
  args: {
    onActivate: activate,
    position: { top: "16px", left: "16px" },
  },
} satisfies Meta<typeof SelectionIconView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: withShadowRootPlay(async (root) => {
    activate.mockClear();
    const page = withinShadowRoot(root);
    const lookup = page.getByRole("button", { name: "Look up with Flyt" });
    const mark = lookup.querySelector("svg")?.getBoundingClientRect();
    await expect(mark?.width).toBe(28);
    await expect(mark?.height).toBe(28);
    await userEvent.click(lookup);
    await expect(activate).toHaveBeenCalledOnce();
  }),
};
