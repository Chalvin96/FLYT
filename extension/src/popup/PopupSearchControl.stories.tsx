import { Button, Popover, PopoverAnchor, PopoverContent } from "@flyt/ui";
import type { Meta, StoryObj } from "@storybook/react";
import { expect } from "storybook/test";

import {
  withShadowRootPlay,
  withinShadowRoot,
} from "../storybook/shadowSurfacePlay";
import { ShadowSurfaceMount } from "../storybook/withShadowSurface";

const K_SM_BOX_PX = 36;

function PopupSearchControl() {
  return (
    <Popover modal={false} open>
      <PopoverAnchor>
        <span>ordbok</span>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        aria-label="Look up “ordbok”"
        onOpenAutoFocus={(event) => event.preventDefault()}
        padding="none"
        width="panel"
      >
        <div className="flex flex-col items-start gap-2 px-3.5 py-3 text-subtle">
          <p>No entry for “ordbok”.</p>
          <div className="mt-2 w-full">
            <Button
              onClick={() => undefined}
              size="sm"
              variant="link"
              width="full"
            >
              Search
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

async function expectPopupSearchControl(shadowRoot: ShadowRoot) {
  const page = withinShadowRoot(shadowRoot);
  const control = await page.findByRole("button", { name: "Search" });
  const copy = page.getByText("No entry for “ordbok”.");

  await expect(getComputedStyle(control).fontSize).toBe("12px");
  await expect(control.getBoundingClientRect().height).toBeLessThan(
    K_SM_BOX_PX,
  );
  await expect(getComputedStyle(control).textDecorationLine).toBe("none");

  const controlBox = control.getBoundingClientRect();
  const copyBox = copy.getBoundingClientRect();
  // #477 criterion 2: the control spans the empty-state row and shares the
  // message's left edge, rather than hugging its own label.
  await expect(controlBox.left).toBeCloseTo(copyBox.left, 0);
  await expect(controlBox.width).toBeGreaterThan(copyBox.width);
}

const meta = {
  title: "Features/Extension/Popup Search control",
  component: PopupSearchControl,
  decorators: [(Story) => <ShadowSurfaceMount Story={Story} />],
  parameters: { layout: "centered" },
} satisfies Meta<typeof PopupSearchControl>;

export default meta;
type Story = StoryObj<typeof meta>;

// #477 criterion 1's hover treatment needs a real pointer, so it is asserted in
// `frontend/e2e/perceived-state.spec.ts` rather than in a play step.
export const RestingTreatment: Story = {
  play: withShadowRootPlay(expectPopupSearchControl),
};
