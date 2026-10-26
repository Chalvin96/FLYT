import type { Meta, StoryObj } from "@storybook/react";
import { useEffect } from "react";
import { expect, fireEvent, userEvent, waitFor } from "storybook/test";

import { installHostileHostPage } from "../storybook/hostileHostPage";
import {
  EMPTY_RESULT_STATE,
  LOADING_STATE,
  RESULT_STATE,
  SENTENCE_STATE,
  resolveStubbedMessage,
} from "../storybook/popupFixtures";
import { MSG_RESULT_KIND } from "../lib/messages";
import type { MsgResult } from "../lib/messages";
import { API_PERMISSION_MESSAGE } from "../lib/permissions";
import { withChrome } from "../storybook/withChrome";
import { ShadowSurfaceMount } from "../storybook/withShadowSurface";
import {
  withShadowRootPlay,
  withinShadowRoot,
} from "../storybook/shadowSurfacePlay";
import { Popup, type PopupState } from "./Popup";

function HostileHostPopup({
  state,
  onImportPage,
}: {
  state: PopupState;
  onImportPage: () => Promise<MsgResult>;
}) {
  useEffect(() => installHostileHostPage(), []);

  return <Popup onImportPage={onImportPage} state={state} />;
}

const meta = {
  title: "Features/Extension/Popup",
  component: Popup,
  decorators: [(Story) => <ShadowSurfaceMount Story={Story} whitePage />],
  parameters: { layout: "fullscreen" },
  args: {
    onImportPage: () =>
      Promise.resolve({ ok: true, kind: MSG_RESULT_KIND.IMPORTED }),
  },
} satisfies Meta<typeof Popup>;
export default meta;

type Story = StoryObj<typeof meta>;

export const LookupResult: Story = {
  args: { state: RESULT_STATE },
  decorators: [withChrome(resolveStubbedMessage)],
  play: withShadowRootPlay(),
};

export const EmptyResult: Story = {
  args: { state: EMPTY_RESULT_STATE },
  decorators: [withChrome(resolveStubbedMessage)],
  play: withShadowRootPlay(),
};

export const Loading: Story = {
  args: { state: LOADING_STATE },
  play: withShadowRootPlay(),
};

export const SearchWithSuggestions: Story = {
  args: { state: RESULT_STATE },
  decorators: [withChrome(resolveStubbedMessage)],
  play: withShadowRootPlay(async (shadowRoot) => {
    const canvas = withinShadowRoot(shadowRoot);

    await userEvent.click(
      await canvas.findByRole("button", { name: "Search" }),
    );
    const search = await canvas.findByRole("textbox");
    await fireEvent.change(search, { target: { value: "få" } });

    await expect(
      await canvas.findByRole("button", { name: "bok" }),
    ).toBeVisible();
  }),
};

export const SentenceResting: Story = {
  args: { state: SENTENCE_STATE },
  decorators: [withChrome(resolveStubbedMessage)],
  play: withShadowRootPlay(),
};

export const SentenceWithWordLookup: Story = {
  args: { state: SENTENCE_STATE },
  decorators: [withChrome(resolveStubbedMessage)],
  play: withShadowRootPlay(async (shadowRoot) => {
    const canvas = withinShadowRoot(shadowRoot);

    const word = await canvas.findByRole("button", { name: "bok" });
    await userEvent.click(word);

    await expect(word).toHaveAttribute("aria-current", "true");
  }),
};

export const SignIn: Story = {
  args: { state: { kind: "signIn" } },
  play: withShadowRootPlay(),
};

export const Error: Story = {
  args: { state: { kind: "error", error: "unknown", word: "hund" } },
  play: withShadowRootPlay(),
};

export const PermissionRequired: Story = {
  args: { state: { kind: "error", error: "permission" } },
  play: withShadowRootPlay(async (shadowRoot) => {
    const canvas = withinShadowRoot(shadowRoot);

    await waitFor(() =>
      expect(canvas.getByText(API_PERMISSION_MESSAGE)).toBeVisible(),
    );
    await expect(
      canvas.queryByRole("button", { name: "Sign in to Flyt" }),
    ).not.toBeInTheDocument();
  }),
};

export const HostileHost: Story = {
  args: { state: RESULT_STATE },
  decorators: [withChrome(resolveStubbedMessage)],
  render: ({ onImportPage, state }) => (
    <HostileHostPopup onImportPage={onImportPage} state={state} />
  ),
  play: withShadowRootPlay(async (shadowRoot) => {
    const popup = withinShadowRoot(shadowRoot).getByRole("dialog");
    const popupStyle = getComputedStyle(popup);
    const surfaceStyle = getComputedStyle(shadowRoot.host);
    const hostStyle = getComputedStyle(document.body);

    await expect(hostStyle.fontFamily).toContain("Comic Sans MS");
    await expect(popupStyle.fontFamily).toBe(surfaceStyle.fontFamily);
    await expect(popupStyle.fontFamily).not.toContain("Comic Sans MS");
    await expect(popupStyle.fontSize).toBe("14px");
    await expect(popupStyle.fontSize).not.toBe("20px");
    await expect(popupStyle.color).toBe("rgb(21, 48, 58)");
    await expect(popupStyle.color).not.toBe(hostStyle.color);
    await expect(popupStyle.borderColor).toBe("rgb(196, 234, 217)");
    await expect(popupStyle.borderColor).not.toBe("rgb(255, 0, 0)");
  }),
};
