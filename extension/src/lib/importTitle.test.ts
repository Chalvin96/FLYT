import { describe, expect, it } from "vitest";

import { TITLE_MAX_LENGTH, boundImportTitle } from "./importTitle";

describe("boundImportTitle", () => {
  it("test_title_given_long_article_title_expect_bounded_to_limit", () => {
    const long = "a".repeat(TITLE_MAX_LENGTH + 50);
    const result = boundImportTitle(long, "doc");
    expect(result).toHaveLength(TITLE_MAX_LENGTH);
  });

  it("test_title_given_normal_article_title_expect_untouched", () => {
    expect(boundImportTitle("  A Norwegian Article  ", "doc")).toBe(
      "A Norwegian Article",
    );
  });

  it("test_title_given_astral_chars_at_boundary_expect_no_lone_surrogate", () => {
    // Each emoji is 1 code point / 2 UTF-16 units.
    const long = "😀".repeat(TITLE_MAX_LENGTH + 10);
    const result = boundImportTitle(long, "doc");

    expect(Array.from(result)).toHaveLength(TITLE_MAX_LENGTH);
    expect(result).toBe("😀".repeat(TITLE_MAX_LENGTH));
    expect(result.match(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/)).toBeNull();
  });

  it("test_title_given_empty_article_title_expect_document_title_fallback", () => {
    expect(boundImportTitle("", "The Document Title")).toBe(
      "The Document Title",
    );
    expect(boundImportTitle(null, "The Document Title")).toBe(
      "The Document Title",
    );
    expect(boundImportTitle(undefined, "The Document Title")).toBe(
      "The Document Title",
    );
  });
});
