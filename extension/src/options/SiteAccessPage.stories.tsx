import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent } from "storybook/test";

import "../../tailwind/index.css";

import { SiteAccessPage } from "./SiteAccessPage";

const meta = {
  title: "Features/Extension/Site access",
  component: SiteAccessPage,
  parameters: { layout: "fullscreen" },
  beforeEach: ({ parameters }) => {
    const originalChrome = globalThis.chrome;
    Object.assign(globalThis, {
      chrome: {
        permissions: {
          contains: fn(async () => parameters.siteAccessGranted === true),
          request: fn(async () => true),
        },
      },
    });
    return () => Object.assign(globalThis, { chrome: originalChrome });
  },
} satisfies Meta<typeof SiteAccessPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NeedsAccess: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", { name: "Allow access to websites" }),
    ).toBeEnabled();
  },
};

export const AllowAccess: Story = {
  play: async ({ canvas }) => {
    const button = canvas.getByRole("button", {
      name: "Allow access to websites",
    });
    await expect(button).toBeEnabled();
    await userEvent.click(button);
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "FlytLese can read pages. Reload the page you were reading.",
    );
  },
};

export const Granted: Story = {
  parameters: { siteAccessGranted: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "FlytLese can read pages. Reload the page you were reading.",
    );
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  },
};
