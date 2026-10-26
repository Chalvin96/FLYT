import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MSG_KIND, MSG_RESULT_KIND, sendMessage } from "../lib/messages";
import {
  RESULT_STATE,
  SENTENCE_STATE,
  resolveStubbedMessage,
} from "../storybook/popupFixtures";
import { Popup, type PopupState } from "./Popup";

vi.mock("../lib/messages", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/messages")>()),
  sendMessage: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(sendMessage).mockReset();
  vi.mocked(sendMessage).mockImplementation(async (message) =>
    resolveStubbedMessage(message),
  );
});

function open(state: PopupState) {
  return render(
    <Popup state={state} onClose={vi.fn()} onImportPage={vi.fn()} />,
  );
}

describe("Popup redesign", () => {
  it.each([
    { error: "network", retry: true, openFlyt: false },
    { error: "unknown", retry: true, openFlyt: true },
    { error: "quota-reached", retry: false, openFlyt: true },
  ] as const)(
    "test_popup_selection_given_word_lookup_failure_expect_matching_recovery_actions",
    async ({ error, retry, openFlyt }) => {
      vi.mocked(sendMessage).mockImplementation(async (message) =>
        message.kind === "resolve"
          ? { ok: false, error, message: "Word lookup unavailable." }
          : resolveStubbedMessage(message),
      );
      open(SENTENCE_STATE);
      await userEvent.click(screen.getByRole("button", { name: "bok" }));
      expect(await screen.findByText("Word lookup unavailable.")).toBeVisible();
      expect(screen.getByRole("heading", { name: "bok" })).toBeVisible();
      expect(Boolean(screen.queryByRole("button", { name: "Try again" }))).toBe(
        retry,
      );
      expect(Boolean(screen.queryByRole("link", { name: "Open Flyt" }))).toBe(
        openFlyt,
      );
      expect(
        screen.queryByRole("button", { name: "Search" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Import page" }),
      ).not.toBeInTheDocument();
      if (retry) {
        await userEvent.click(
          screen.getByRole("button", { name: "Try again" }),
        );
        expect(sendMessage).toHaveBeenLastCalledWith({
          kind: "resolve",
          word: "bok",
        });
        const translations = vi
          .mocked(sendMessage)
          .mock.calls.filter(([message]) => message.kind === "translate");
        expect(translations).toHaveLength(1);
      }
    },
  );

  it("test_popup_translation_given_failure_after_word_entry_expect_translation_retry_available", async () => {
    const failTranslation = vi.fn<() => void>();
    vi.mocked(sendMessage).mockImplementation((message) => {
      if (message.kind === "translate")
        return new Promise((resolve) => {
          failTranslation.mockImplementation(() =>
            resolve({ ok: false, error: "network" }),
          );
        });
      return Promise.resolve(
        message.kind === "resolve"
          ? { ok: true, kind: "resolve", data: RESULT_STATE.res }
          : resolveStubbedMessage(message),
      );
    });
    open(SENTENCE_STATE);
    await userEvent.click(screen.getByRole("button", { name: "bok" }));
    await screen.findByRole("article", { name: "bok dictionary" });
    await act(async () => failTranslation());
    await userEvent.click(
      await screen.findByRole("button", { name: "Try again" }),
    );
    expect(sendMessage).toHaveBeenLastCalledWith({
      kind: "translate",
      text: SENTENCE_STATE.selection.source_sentence,
    });
  });

  it("test_popup_search_given_lookup_failure_from_translation_expect_error_and_same_word_retry", async () => {
    vi.mocked(sendMessage).mockImplementation(async (message) =>
      message.kind === "resolve"
        ? { ok: false, error: "network" }
        : message.kind === "search"
          ? { ok: true, kind: "suggestions", data: ["hund"] }
          : resolveStubbedMessage(message),
    );
    open(SENTENCE_STATE);
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await userEvent.type(screen.getByRole("textbox"), "hund");
    await userEvent.click(await screen.findByRole("button", { name: "hund" }));
    expect(
      await screen.findByText("Can't reach Flyt. Check your connection."),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "hund" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() =>
      expect(sendMessage).toHaveBeenLastCalledWith({
        kind: "resolve",
        word: "hund",
      }),
    );
    expect(
      screen.queryByRole("button", { name: "Import page" }),
    ).not.toBeInTheDocument();
  });

  it("test_popup_selection_given_current_word_clicked_again_expect_entry_dismissed_and_focus_kept", async () => {
    vi.mocked(sendMessage).mockImplementation(async (message) =>
      message.kind === "resolve"
        ? { ok: true, kind: "resolve", data: RESULT_STATE.res }
        : resolveStubbedMessage(message),
    );
    open(SENTENCE_STATE);
    const word = screen.getByRole("button", { name: "bok" });
    await userEvent.click(word);
    await screen.findByRole("article", { name: "bok dictionary" });
    await userEvent.click(word);
    expect(
      screen.queryByRole("article", { name: "bok dictionary" }),
    ).not.toBeInTheDocument();
    expect(word).toHaveFocus();
    expect(word).not.toHaveAttribute("aria-current");
  });

  it.each([
    {
      error: "network",
      copy: "Can't reach Flyt. Check your connection.",
      retry: true,
      openFlyt: false,
    },
    {
      error: "unknown",
      copy: "Something went wrong on Flyt's side.",
      retry: true,
      openFlyt: true,
    },
    {
      error: "quota-reached",
      copy: "You've reached today's limit.",
      retry: false,
      openFlyt: true,
    },
  ] as const)(
    "test_popup_error_given_error_kind_expect_matching_copy_and_actions",
    ({ error, copy, retry, openFlyt }) => {
      const state = { kind: "error", error, word: "hund" } as const;
      open(state);

      expect(screen.getByText(copy)).toBeVisible();
      expect(screen.getByRole("heading", { name: "hund" })).toBeVisible();
      expect(Boolean(screen.queryByRole("button", { name: "Try again" }))).toBe(
        retry,
      );
      expect(Boolean(screen.queryByRole("link", { name: "Open Flyt" }))).toBe(
        openFlyt,
      );
      expect(
        screen.queryByRole("button", { name: "Search" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Import/ }),
      ).not.toBeInTheDocument();
    },
  );

  it("test_popup_error_given_backend_message_expect_backend_copy", () => {
    const state = {
      kind: "error",
      error: "quota-reached",
      word: "hund",
      message: "Translation allowance used. Try tomorrow.",
    } as const;
    open(state);

    expect(screen.getByText(state.message)).toBeVisible();
    expect(screen.getByRole("link", { name: "Open Flyt" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });

  it("test_popup_error_given_retry_expect_same_word_dispatched_and_result_shown", async () => {
    vi.mocked(sendMessage).mockImplementation(async (message) =>
      message.kind === MSG_KIND.RESOLVE
        ? { ok: true, kind: MSG_RESULT_KIND.RESOLVE, data: RESULT_STATE.res }
        : resolveStubbedMessage(message),
    );
    const state = { kind: "error", error: "network", word: "bøker" } as const;
    open(state);

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(sendMessage).toHaveBeenCalledWith({
      kind: MSG_KIND.RESOLVE,
      word: "bøker",
    });
    expect(await screen.findByRole("heading", { name: "bok" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Import page" })).toBeVisible();
  });

  it("test_popup_error_given_retry_without_candidates_expect_translation_instead_of_stale_error", async () => {
    vi.mocked(sendMessage).mockImplementation(async (message) =>
      message.kind === MSG_KIND.RESOLVE
        ? {
            ok: true,
            kind: MSG_RESULT_KIND.RESOLVE,
            data: { query: message.word, candidates: [] },
          }
        : resolveStubbedMessage(message),
    );
    open({
      kind: "error",
      error: "network",
      word: "ukjentord",
      context: {
        source_sentence: "Et ukjentord i teksten.",
        source_title: "News",
      },
    });

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Selected text")).toBeVisible();
    expect(
      screen.getByRole("dialog", { name: "Translate selected text" }),
    ).toBeVisible();
    expect(screen.getByText("From: News")).toBeVisible();
    expect(sendMessage).toHaveBeenCalledWith({
      kind: MSG_KIND.TRANSLATE,
      text: "ukjentord",
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import page" })).toBeVisible();
  });

  it("test_popup_retry_translation_given_further_word_lookup_expect_translation_retained_without_second_request", async () => {
    vi.mocked(sendMessage).mockImplementation(async (message) =>
      message.kind === MSG_KIND.RESOLVE
        ? {
            ok: true,
            kind: MSG_RESULT_KIND.RESOLVE,
            data: { query: message.word, candidates: [] },
          }
        : resolveStubbedMessage(message),
    );
    open({ kind: "error", error: "network", word: "ukjentord" });
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("Selected text");

    await userEvent.click(screen.getByRole("button", { name: "ukjentord" }));
    await screen.findByText('No dictionary entry for "ukjentord".');

    expect(screen.getByText("Selected text")).toBeVisible();
    expect(
      vi
        .mocked(sendMessage)
        .mock.calls.filter(([message]) => message.kind === MSG_KIND.TRANSLATE),
    ).toHaveLength(1);
  });

  it.each(["too-large", "invalid-page"] as const)(
    "test_popup_import_error_given_nonretryable_input_failure_expect_backend_message_and_open_flyt",
    (error) => {
      open({ kind: "error", error, message: "This page cannot be imported." });

      expect(screen.getByText("This page cannot be imported.")).toBeVisible();
      expect(screen.getByRole("link", { name: "Open Flyt" })).toBeVisible();
      expect(
        screen.queryByRole("button", { name: "Try again" }),
      ).not.toBeInTheDocument();
    },
  );

  it.each(["too-large", "invalid-page"] as const)(
    "test_popup_import_error_given_input_failure_without_message_expect_existing_fallback_and_no_retry",
    (error) => {
      open({ kind: "error", error });

      expect(
        screen.getByText("Something went wrong on Flyt's side."),
      ).toBeVisible();
      expect(screen.getByRole("link", { name: "Open Flyt" })).toBeVisible();
      expect(
        screen.queryByRole("button", { name: "Try again" }),
      ).not.toBeInTheDocument();
    },
  );

  it.each([
    RESULT_STATE,
    SENTENCE_STATE,
    { kind: "loading", word: "hund" } satisfies PopupState,
  ])(
    "test_popup_chrome_given_importable_state_expect_page_strip_and_header_search",
    (state) => {
      open(state);
      expect(screen.getByRole("button", { name: "Import page" })).toBeVisible();
      expect(screen.getByRole("button", { name: "Search" })).toBeVisible();
    },
  );

  it.each([
    { kind: "signIn" },
    { kind: "error", error: "permission" },
  ] as const)(
    "test_popup_chrome_given_access_state_expect_no_search_or_page_strip",
    (state) => {
      open(state);
      expect(
        screen.queryByRole("button", { name: "Search" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Import/ }),
      ).not.toBeInTheDocument();
    },
  );

  it("test_popup_loading_given_known_word_expect_busy_panel_and_no_word_actions", () => {
    open({ kind: "loading", word: "hund" });
    expect(screen.getByRole("heading", { name: "hund" })).toBeVisible();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "true");
    expect(
      screen.queryByRole("button", { name: "Add to review" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "I already know this" }),
    ).not.toBeInTheDocument();
  });

  it("test_popup_loading_given_keyboard_navigation_expect_action_placeholders_skipped", async () => {
    open({ kind: "loading", word: "hund" });
    await waitFor(() => expect(screen.getByRole("dialog")).toHaveFocus());

    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Search" })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Import page" })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Search" })).toHaveFocus();
  });

  it("test_popup_focus_given_mouse_open_expect_panel_focused_and_keyboard_wrap_preserved", async () => {
    open(RESULT_STATE);
    const panel = screen.getByRole("dialog");
    await waitFor(() => expect(panel).toHaveFocus());
    expect(panel).toHaveAttribute("tabindex", "-1");
    await userEvent.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Import page" })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Search" })).toHaveFocus();
  });

  it("test_popup_search_given_header_search_expect_focused_input_and_page_strip", async () => {
    open(RESULT_STATE);
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(screen.getByRole("textbox")).toHaveFocus();
    expect(screen.getByRole("button", { name: "Import page" })).toBeVisible();
  });

  it("test_popup_meanings_given_multiple_senses_expect_first_sense_then_disclosure", async () => {
    open(RESULT_STATE);
    await screen.findByText("Other forms");
    expect(
      screen.queryByText("hefte med blanke eller linjerte sider"),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "More meanings (1)" }),
    );
    expect(
      screen.getByText("hefte med blanke eller linjerte sider"),
    ).toBeVisible();
  });

  it("test_popup_translation_given_failure_expect_running_text_without_search_or_page_strip", async () => {
    vi.mocked(sendMessage).mockResolvedValue({ ok: false, error: "network" });
    open(SENTENCE_STATE);
    expect(
      await screen.findByText("Can't reach Flyt. Check your connection."),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "bok" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Search" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Import/ }),
    ).not.toBeInTheDocument();
  });
});
