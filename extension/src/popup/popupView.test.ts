import { describe, expect, it } from "vitest";

import { buildPopupAriaLabel } from "./popupView";

describe("buildPopupAriaLabel", () => {
  it("test_expression_result_given_verified_form_expect_natural_accessible_label", () => {
    expect(
      buildPopupAriaLabel({
        kind: "result",
        res: {
          query: "få [stelle|lage] i stand",
          candidates: [
            {
              lemma_uuid: "expression-1",
              word: "få [stelle|lage] i stand",
              pos: "expression",
              hgno: 1,
              definitions: [],
              primary_display_form: "få i stand",
              alternative_forms: ["stelle i stand"],
            },
          ],
        },
      }),
    ).toBe("Definition of få i stand");
  });
});
