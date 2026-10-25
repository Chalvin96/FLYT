import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent } from "storybook/test";

import { Popup } from "./Popup";
import { PAGE_TITLE, redesignReply } from "../storybook/redesignFixtures";
import { withChrome } from "../storybook/withChrome";
import { ShadowSurfaceMount } from "../storybook/withShadowSurface";
import {
  withShadowRootPlay,
  withinShadowRoot,
} from "../storybook/shadowSurfacePlay";

const meta = {
  title: "Features/Extension/Redesign errors",
  component: Popup,
  decorators: [
    (Story) => <ShadowSurfaceMount Story={Story} whitePage />,
    withChrome(redesignReply),
  ],
  parameters: { layout: "fullscreen" },
  args: {
    onClose: () => {},
    onImportPage: async () => ({ ok: true, kind: "imported" }),
  },
} satisfies Meta<typeof Popup>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Network: Story = {
  args: { state: { kind: "error", error: "network", word: "hund" } },
  play: withShadowRootPlay(async (root) => {
    const page = withinShadowRoot(root);
    await expect(
      page.getByText("Can't reach Flyt. Check your connection."),
    ).toBeVisible();
    await expect(
      page.queryByRole("link", { name: "Open Flyt" }),
    ).not.toBeInTheDocument();
    await expect(
      page.queryByRole("button", { name: "Search" }),
    ).not.toBeInTheDocument();
    await expect(
      page.queryByRole("button", { name: "Import page" }),
    ).not.toBeInTheDocument();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  }),
};

export const NetworkRetry: Story = {
  args: Network.args,
  play: withShadowRootPlay(async (root) => {
    const page = withinShadowRoot(root);
    await userEvent.click(page.getByRole("button", { name: "Try again" }));
    await expect(await page.findByText("I have a small dog.")).toBeVisible();
  }),
};

export const Unknown: Story = {
  args: { state: { kind: "error", error: "unknown", word: "hund" } },
  play: withShadowRootPlay(async (root) => {
    const page = withinShadowRoot(root);
    await expect(page.getByRole("link", { name: "Open Flyt" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  }),
};

export const QuotaReached: Story = {
  args: {
    state: {
      kind: "error",
      error: "quota-reached",
      word: "hund",
      message: "You've reached today's limit.",
    },
  },
  play: withShadowRootPlay(async (root) => {
    const page = withinShadowRoot(root);
    await expect(page.getByText("You've reached today's limit.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Flyt" })).toBeVisible();
    await expect(
      page.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  }),
};

export const Loading: Story = {
  args: {
    state: {
      kind: "loading",
      word: "hund",
      context: { source_sentence: "En hund.", source_title: PAGE_TITLE },
    },
  },
  play: withShadowRootPlay(async (root) => {
    const page = withinShadowRoot(root);
    await expect(page.getByRole("dialog")).toHaveAttribute("aria-busy", "true");
    await expect(page.getByRole("heading", { name: "hund" })).toBeVisible();
    await expect(
      page.queryByRole("button", { name: "Add to review" }),
    ).not.toBeInTheDocument();
    await expect(
      page.getByRole("button", { name: "Import page" }),
    ).toBeVisible();
  }),
};

export const AccessNeeded: Story = {
  args: { state: { kind: "error", error: "permission" } },
  play: withShadowRootPlay(async (root) => {
    const page = withinShadowRoot(root);
    await expect(
      page.getByText(
        "Click the FlytLese toolbar button to allow access to Flyt.",
      ),
    ).toBeVisible();
    await expect(
      page.queryByRole("button", { name: "Search" }),
    ).not.toBeInTheDocument();
    await expect(
      page.queryByRole("button", { name: "Import page" }),
    ).not.toBeInTheDocument();
  }),
};

export const SignIn: Story = {
  args: { state: { kind: "signIn" } },
  play: withShadowRootPlay(async (root) => {
    const page = withinShadowRoot(root);
    await expect(
      page.getByRole("button", { name: "Sign in to Flyt" }),
    ).toBeVisible();
    await expect(
      page.queryByRole("button", { name: "Import page" }),
    ).not.toBeInTheDocument();
  }),
};
