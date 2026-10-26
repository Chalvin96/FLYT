import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sendMessage } from "../lib/messages";

import { SentenceView, type SentenceViewHandle } from "./SentenceView";

vi.mock("../lib/messages", async () => {
  const actual =
    await vi.importActual<typeof import("../lib/messages")>("../lib/messages");
  return { ...actual, sendMessage: vi.fn() };
});

beforeEach(() => {
  vi.mocked(sendMessage).mockReset();
});

const selection = {
  source_sentence: "Jeg heter Kari.",
} as Parameters<typeof SentenceView>[0]["selection"];

describe("SentenceView", () => {
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
    "test_sentence_error_given_error_kind_expect_matching_copy_and_actions",
    async ({ error, copy, retry, openFlyt }) => {
      vi.mocked(sendMessage).mockResolvedValue({ ok: false, error });
      render(<SentenceView selection={selection} onResolveWord={() => {}} />);
      expect(await screen.findByText(copy)).toBeVisible();
      expect(Boolean(screen.queryByRole("button", { name: "Try again" }))).toBe(
        retry,
      );
      expect(Boolean(screen.queryByRole("link", { name: "Open Flyt" }))).toBe(
        openFlyt,
      );
    },
  );

  it("test_sentence_error_given_retry_expect_identical_translation_request", async () => {
    vi.mocked(sendMessage).mockResolvedValue({ ok: false, error: "network" });
    render(<SentenceView selection={selection} onResolveWord={() => {}} />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Try again" }),
    );
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(vi.mocked(sendMessage).mock.calls[1]).toEqual(
      vi.mocked(sendMessage).mock.calls[0],
    );
  });

  it("test_sentence_cap_given_long_selection_expect_last_complete_sentence_and_sentence_counts", async () => {
    const first = "Dette er en hel setning. ".repeat(60);
    const last = "Neste setning er for lang til å få plass. ".repeat(25);
    vi.mocked(sendMessage).mockReturnValue(new Promise(() => {}));
    render(
      <SentenceView
        selection={{ source_sentence: first + last }}
        onResolveWord={() => {}}
      />,
    );
    const request = vi.mocked(sendMessage).mock.calls[0]?.[0];
    expect(request?.kind).toBe("translate");
    if (request?.kind !== "translate")
      throw new Error("Missing translation request");
    expect(Array.from(request.text).length).toBeLessThanOrEqual(2000);
    expect(request.text).toMatch(/\.$/);
    expect(
      screen.getByText(/Translated the first \d+ of 85 sentences\./),
    ).toBeVisible();
  });

  it("test_sentence_cap_given_one_giant_sentence_expect_word_boundary_without_broken_unicode", () => {
    vi.mocked(sendMessage).mockReturnValue(new Promise(() => {}));
    render(
      <SentenceView
        selection={{ source_sentence: "😀 langt ord ".repeat(250) }}
        onResolveWord={() => {}}
      />,
    );
    const request = vi.mocked(sendMessage).mock.calls[0]?.[0];
    if (request?.kind !== "translate")
      throw new Error("Missing translation request");
    expect(Array.from(request.text).length).toBeLessThanOrEqual(2000);
    expect(request.text).not.toMatch(/[\uD800-\uDBFF]$/u);
    expect(
      request.text.endsWith("ord") ||
        request.text.endsWith("langt") ||
        request.text.endsWith("😀"),
    ).toBe(true);
    expect(
      screen.getByText("Translated the first part of the selection."),
    ).toBeVisible();
  });

  it.each(["a", "1234", "!!! ???", "😀"])(
    "test_sentence_translation_given_untranslatable_selection_expect_echo_without_request_or_recovery_actions",
    async (text) => {
      vi.mocked(sendMessage).mockResolvedValue({ ok: false, error: "unknown" });
      render(
        <SentenceView
          selection={{ source_sentence: text }}
          onResolveWord={vi.fn()}
        />,
      );

      expect(
        await screen.findByText(text, { selector: "[lang=en]" }),
      ).toBeVisible();
      expect(sendMessage).not.toHaveBeenCalled();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Try again" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: "Open Flyt" }),
      ).not.toBeInTheDocument();
    },
  );

  it.each(["too-large", "invalid-page"] as const)(
    "test_sentence_translation_given_rejected_input_expect_source_echo_without_error_or_retry",
    async (error) => {
      vi.mocked(sendMessage).mockResolvedValue({
        ok: false,
        error,
        message: "Cannot translate.",
      });
      render(<SentenceView selection={selection} onResolveWord={vi.fn()} />);

      expect(
        await screen.findByText(selection.source_sentence, {
          selector: "[lang=en]",
        }),
      ).toBeVisible();
      expect(sendMessage).toHaveBeenCalledExactlyOnceWith({
        kind: "translate",
        text: selection.source_sentence,
      });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Try again" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: "Open Flyt" }),
      ).not.toBeInTheDocument();
    },
  );

  it("test_sentence_clamp_given_overflowing_source_and_translation_expect_independent_toggles", async () => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(160);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(72);
    vi.mocked(sendMessage).mockResolvedValue({
      ok: true,
      kind: "translated",
      data: {
        source_text: selection.source_sentence,
        translated_text: "My name is Kari.",
        source_language: "no",
        target_language: "en",
      },
    });
    render(<SentenceView selection={selection} onResolveWord={() => {}} />);
    await screen.findByText("My name is Kari.");
    const sourceToggle = screen.getByRole("button", {
      name: "Show all selected text",
    });
    const translationToggle = screen.getByRole("button", {
      name: "Show all translation",
    });
    expect(sourceToggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(sourceToggle);
    expect(
      screen.getByRole("button", { name: "Show less selected text" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(translationToggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(translationToggle);
    expect(
      screen.getByRole("button", { name: "Show less translation" }),
    ).toHaveAttribute("aria-expanded", "true");
    vi.restoreAllMocks();
  });

  it("test_sentence_view_given_translation_in_flight_expect_status_announced_on_mount", () => {
    vi.mocked(sendMessage).mockReturnValue(new Promise(() => {}));

    render(<SentenceView selection={selection} onResolveWord={() => {}} />);

    expect(screen.getByRole("status")).toHaveTextContent("Translating…");
  });

  it("test_sentence_view_given_one_word_twice_expect_only_the_active_occurrence_current", () => {
    vi.mocked(sendMessage).mockReturnValue(new Promise(() => {}));

    render(
      <SentenceView
        activeToken={{ word: "bok", occurrence: 1 }}
        onResolveWord={() => {}}
        selection={{ source_sentence: "Jeg leser bok, og bok." }}
      />,
    );

    const tokens = screen.getAllByRole("button", { name: "bok" });
    expect(tokens).toHaveLength(2);
    expect(tokens[0]).toHaveAttribute("data-state", "idle");
    expect(tokens[1]).toHaveAttribute("data-state", "current");
  });

  it("test_sentence_view_given_focus_token_expect_that_occurrence_focused", () => {
    vi.mocked(sendMessage).mockReturnValue(new Promise(() => {}));
    const view = createRef<SentenceViewHandle>();

    render(
      <SentenceView
        onResolveWord={() => {}}
        ref={view}
        selection={{ source_sentence: "Jeg leser bok, og bok." }}
      />,
    );

    view.current?.focusToken({ word: "bok", occurrence: 1 });

    expect(screen.getAllByRole("button", { name: "bok" })[1]).toHaveFocus();
  });
});
