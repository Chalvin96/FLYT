import type { Meta, StoryObj } from "@storybook/react";

import { ShadowSurfaceMount } from "../storybook/withShadowSurface";
import { withShadowRootPlay } from "../storybook/shadowSurfacePlay";
import { ImportToast } from "./ImportToast";

const IMPORTS_URL = "http://localhost:5173/reading/imports";

const meta = {
  title: "Features/Extension/Import toast",
  component: ImportToast,
  decorators: [
    (Story) => (
      <div id="stage">
        <ShadowSurfaceMount Story={Story} whitePage />
      </div>
    ),
  ],
  parameters: { layout: "fullscreen" },
  args: { importsUrl: IMPORTS_URL, onClose: () => {} },
} satisfies Meta<typeof ImportToast>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Importing: Story = {
  args: { status: { kind: "importing" } },
  play: withShadowRootPlay(),
};

export const Saved: Story = {
  args: { status: { kind: "success" } },
  play: withShadowRootPlay(),
};

export const Failed: Story = {
  args: { status: { kind: "error", message: "Could not import this page." } },
  play: withShadowRootPlay(),
};
