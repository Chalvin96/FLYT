import { describe, expect, it } from "vitest";

import { capTranslationSelection } from "./capTranslationSelection";

describe("capTranslationSelection", () => {
  it("test_selection_cap_given_exactly_2000_code_points_expect_full_text_without_notice", () => {
    const source = "a".repeat(2000);

    expect(capTranslationSelection(source)).toEqual({
      text: source,
      notice: null,
    });
  });

  it("test_selection_cap_given_2001_code_points_without_spaces_expect_2000_code_point_prefix", () => {
    expect(capTranslationSelection("a".repeat(2001))).toEqual({
      text: "a".repeat(2000),
      notice: "Translated the first part of the selection.",
    });
  });

  it("test_selection_cap_given_many_sentences_over_limit_expect_complete_sentences_and_counts", () => {
    expect(capTranslationSelection("Dette er norsk. ".repeat(130))).toEqual({
      text: "Dette er norsk. ".repeat(125).trimEnd(),
      notice: "Translated the first 125 of 130 sentences.",
    });
  });

  it("test_selection_cap_given_short_word_before_long_token_expect_hard_cut", () => {
    expect(capTranslationSelection("a " + "b".repeat(2100))).toEqual({
      text: "a " + "b".repeat(1998),
      notice: "Translated the first part of the selection.",
    });
  });

  it("test_selection_cap_given_word_boundary_past_half_limit_expect_word_boundary_cut", () => {
    expect(
      capTranslationSelection("a".repeat(1200) + " " + "b".repeat(1100)),
    ).toEqual({
      text: "a".repeat(1200),
      notice: "Translated the first part of the selection.",
    });
  });

  it("test_selection_cap_given_word_boundary_at_half_limit_expect_hard_cut", () => {
    expect(
      capTranslationSelection("a".repeat(1000) + " " + "b".repeat(1100)),
    ).toEqual({
      text: "a".repeat(1000) + " " + "b".repeat(999),
      notice: "Translated the first part of the selection.",
    });
  });

  it("test_selection_cap_given_whitespace_padded_text_that_fits_expect_trimmed_text_without_notice", () => {
    const source = "a".repeat(2000);

    expect(capTranslationSelection(" \n" + source + "\t ")).toEqual({
      text: source,
      notice: null,
    });
  });

  it("test_selection_cap_given_whitespace_padded_sentences_that_fit_expect_no_notice", () => {
    const source = "Dette er norsk. ".repeat(125).trimEnd();

    expect(capTranslationSelection("  " + source + "  ")).toEqual({
      text: source,
      notice: null,
    });
  });

  it("test_selection_cap_given_2000_code_points_with_emoji_expect_full_text_without_notice", () => {
    const source = "a" + "😀".repeat(1999);

    expect(capTranslationSelection(source)).toEqual({
      text: source,
      notice: null,
    });
  });

  it("test_selection_cap_given_emoji_over_limit_expect_whole_code_points", () => {
    expect(capTranslationSelection("a" + "😀".repeat(2000))).toEqual({
      text: "a" + "😀".repeat(1999),
      notice: "Translated the first part of the selection.",
    });
  });

  it("test_selection_cap_given_emoji_before_early_word_boundary_expect_code_point_threshold", () => {
    expect(
      capTranslationSelection("😀".repeat(600) + " " + "a".repeat(2100)),
    ).toEqual({
      text: "😀".repeat(600) + " " + "a".repeat(1399),
      notice: "Translated the first part of the selection.",
    });
  });
});
