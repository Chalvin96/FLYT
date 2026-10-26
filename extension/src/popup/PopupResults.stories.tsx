import type { Meta, StoryObj } from "@storybook/react";
import { expect, fireEvent, userEvent, waitFor } from "storybook/test";

import { Popup } from "./Popup";
import {
  PAGE_TITLE,
  redesignReply,
  resultState,
} from "../storybook/redesignFixtures";
import { withChrome } from "../storybook/withChrome";
import { ShadowSurfaceMount } from "../storybook/withShadowSurface";
import {
  withShadowRootPlay,
  withinShadowRoot,
} from "../storybook/shadowSurfacePlay";

const meta = {
  title: "Features/Extension/Redesign results",
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

export const OneSense: Story = {
  args: { state: resultState("hund") },
  play: withShadowRootPlay(async (root) => {
    const page = withinShadowRoot(root);
    await expect(await page.findByText("I have a small dog.")).toBeVisible();
    await expect(page.getByText(PAGE_TITLE)).toBeVisible();
    await expect(page.getByRole("button", { name: "Search" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Import page" }),
    ).toBeVisible();
    await waitFor(() =>
      expect(root.activeElement).toBe(page.getByRole("dialog")),
    );
    await userEvent.tab({ shift: true });
    await expect(root.activeElement).toBe(
      page.getByRole("button", { name: "Import page" }),
    );
    await userEvent.tab();
    await expect(root.activeElement).toBe(
      page.getByRole("button", { name: "Search" }),
    );
  }),
};

export const MultipleSenses: Story = {
  args: { state: resultState("tre") },
  play: withShadowRootPlay(async (root) => {
    const page = withinShadowRoot(root);
    const toggle = await page.findByRole("button", {
      name: "More meanings (1)",
    });
    await expect(
      page.queryByText("materiale fra stammen til et tre"),
    ).not.toBeInTheDocument();
    await userEvent.click(toggle);
    await expect(
      page.getByText("materiale fra stammen til et tre"),
    ).toBeVisible();
    await userEvent.click(page.getByRole("button", { name: "Fewer meanings" }));
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  }),
};

export const Homographs: Story = {
  args: { state: resultState("tre", true) },
  play: withShadowRootPlay(async (root) => {
    const page = withinShadowRoot(root);
    const row = await page.findByText("NUM · three");
    await expect(page.getByText("tallet 3")).not.toBeVisible();
    await userEvent.click(row);
    await expect(page.getByText("tallet 3")).toBeVisible();
    await userEvent.click(row);
    await expect(page.getByText("tallet 3")).not.toBeVisible();
  }),
};

export const Search: Story = {
  args: { state: resultState("hund") },
  play: withShadowRootPlay(async (root) => {
    const page = withinShadowRoot(root);
    await userEvent.click(page.getByRole("button", { name: "Search" }));
    const input = page.getByRole("textbox");
    await expect(root.activeElement).toBe(input);
    await fireEvent.change(input, { target: { value: "sjø" } });
    await expect(
      await page.findByRole("button", { name: "sjømat" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Import page" }),
    ).toBeVisible();
  }),
};
