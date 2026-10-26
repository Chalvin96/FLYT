import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor } from "storybook/test";

import { Popup } from "./Popup";
import {
  BOOK_SENTENCE,
  LONG_SELECTION,
  LONG_TRANSLATION,
  redesignReply,
  selectionState,
} from "../storybook/redesignFixtures";
import { withChrome } from "../storybook/withChrome";
import { ShadowSurfaceMount } from "../storybook/withShadowSurface";
import {
  withShadowRootPlay,
  withinShadowRoot,
} from "../storybook/shadowSurfacePlay";

const meta = {
  title: "Features/Extension/Redesign translation",
  component: Popup,
  decorators: [(Story) => <ShadowSurfaceMount Story={Story} whitePage />],
  parameters: { layout: "fullscreen" },
  args: {
    onClose: () => {},
    onImportPage: async () => ({ ok: true, kind: "imported" }),
  },
} satisfies Meta<typeof Popup>;
export default meta;
type Story = StoryObj<typeof meta>;

export const OneSentence: Story = {
  args: { state: selectionState(BOOK_SENTENCE) },
  decorators: [withChrome(redesignReply)],
  play: withShadowRootPlay(async (root) => {
    const page = withinShadowRoot(root);
    await expect(
      await page.findByText("I read a book every day."),
    ).toBeVisible();
    await expect(
      page.queryByRole("button", { name: "Show all selected text" }),
    ).not.toBeInTheDocument();
    await userEvent.click(page.getByRole("button", { name: "bok" }));
    await waitFor(() =>
      expect(
        page.getByText("samling av sider med tekst eller bilder"),
      ).toBeVisible(),
    );
    await expect(page.getByRole("button", { name: "bok" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(
      page.getByRole("button", { name: "Add to review" }),
    ).toBeVisible();
  }),
};

export const ThreeSentencesClamped: Story = {
  args: { state: selectionState(LONG_SELECTION) },
  decorators: [withChrome(redesignReply)],
  play: withShadowRootPlay(async (root) => {
    const page = withinShadowRoot(root);
    await expect(await page.findByText(LONG_TRANSLATION)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Show all selected text" }),
    ).toHaveAttribute("aria-expanded", "false");
    await expect(
      page.getByRole("button", { name: "Show all translation" }),
    ).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(page.getByRole("button", { name: "bakeri" }));
    await expect(
      await page.findByRole("heading", { name: "bakeri" }),
    ).toBeVisible();
  }),
};

export const ThreeSentencesExpanded: Story = {
  args: { state: selectionState(LONG_SELECTION) },
  decorators: [withChrome(redesignReply)],
  play: withShadowRootPlay(async (root) => {
    const page = withinShadowRoot(root);
    const source = await page.findByRole("button", {
      name: "Show all selected text",
    });
    await userEvent.click(source);
    await expect(
      await page.findByRole("button", { name: "Show less selected text" }),
    ).toHaveAttribute("aria-expanded", "true");
    const translation = await page.findByRole("button", {
      name: "Show all translation",
    });
    await expect(translation).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(page.getByRole("button", { name: "bakeri" }));
    await expect(
      await page.findByRole("heading", { name: "bakeri" }),
    ).toBeVisible();
    const importBefore = page
      .getByRole("button", { name: "Import page" })
      .getBoundingClientRect();
    await userEvent.click(translation);
    await expect(
      page.getByRole("button", { name: "Show less translation" }),
    ).toHaveAttribute("aria-expanded", "true");
    const importAfter = page
      .getByRole("button", { name: "Import page" })
      .getBoundingClientRect();
    await expect(importAfter.y).toBe(importBefore.y);
    await userEvent.click(
      page.getByRole("button", { name: "Show less translation" }),
    );
  }),
};

export const KeyboardReveal: Story = {
  args: ThreeSentencesClamped.args,
  decorators: [withChrome(redesignReply)],
  play: withShadowRootPlay(async (root) => {
    const page = withinShadowRoot(root);
    await page.findByRole("button", { name: "Show all selected text" });
    const lastWord = page.getByRole("button", { name: "torget" });
    lastWord.focus();
    await expect(root.activeElement).toBe(lastWord);
    await expect(
      await page.findByRole("button", { name: "Show less selected text" }),
    ).toHaveAttribute("aria-expanded", "true");
  }),
};

export const OverLimit: Story = {
  args: { state: selectionState(`${LONG_SELECTION} `.repeat(12)) },
  decorators: [
    withChrome((message) => {
      if (message.kind === "translate") {
        expect(Array.from(message.text).length).toBeLessThanOrEqual(2000);
        expect(message.text).toMatch(/\.$/);
      }
      return redesignReply(message);
    }),
  ],
  play: withShadowRootPlay(async (root) => {
    const page = withinShadowRoot(root);
    await expect(
      await page.findByText(/Translated the first \d+ of 36 sentences\./),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Import page" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Show all selected text" }),
    ).toHaveAttribute("aria-expanded", "false");
  }),
};

export const Failure: Story = {
  args: { state: selectionState(BOOK_SENTENCE) },
  decorators: [
    withChrome((message) =>
      message.kind === "translate"
        ? { ok: false, error: "unknown" }
        : redesignReply(message),
    ),
  ],
  play: withShadowRootPlay(async (root) => {
    const page = withinShadowRoot(root);
    await expect(
      await page.findByText("Something went wrong on Flyt's side."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "bok" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Flyt" })).toBeVisible();
    await expect(
      page.queryByRole("button", { name: "Search" }),
    ).not.toBeInTheDocument();
    await expect(
      page.queryByRole("button", { name: "Import page" }),
    ).not.toBeInTheDocument();
  }),
};

export const WordLookupFailure: Story = {
  args: OneSentence.args,
  decorators: [
    withChrome((message) =>
      message.kind === "resolve"
        ? {
            ok: false,
            error: "unknown",
            message: "Dictionary temporarily unavailable.",
          }
        : redesignReply(message),
    ),
  ],
  play: withShadowRootPlay(async (root) => {
    const page = withinShadowRoot(root);
    await userEvent.click(page.getByRole("button", { name: "bok" }));
    await expect(
      await page.findByText("Dictionary temporarily unavailable."),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "bok" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Flyt" })).toBeVisible();
    await expect(
      page.queryByRole("button", { name: "Search" }),
    ).not.toBeInTheDocument();
    await expect(
      page.queryByRole("button", { name: "Import page" }),
    ).not.toBeInTheDocument();
  }),
};
