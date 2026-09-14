import { describe, expect, it } from "vitest";

import { buildLemmaCardData } from "./lemmaCardData";

describe("buildLemmaCardData", () => {
  it("test_expression_candidate_given_verified_forms_expect_natural_card_data", () => {
    const card = buildLemmaCardData({
      lemma_uuid: "expression-1",
      word: "få [stelle|lage] i stand",
      pos: "expression",
      hgno: 1,
      definitions: [],
      primary_display_form: "få i stand",
      alternative_forms: ["stelle i stand"],
    });

    expect(card.word).toBe("få [stelle|lage] i stand");
    expect(card.primary_display_form).toBe("få i stand");
    expect(card.alternative_forms).toEqual(["stelle i stand"]);
    expect(card.pos).toBe("expression");
  });
});
