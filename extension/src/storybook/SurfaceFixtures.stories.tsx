import type { Meta, StoryObj } from "@storybook/react";
import {
  Heading,
  Text,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@flyt/ui";

import { withShadowRootPlay } from "./shadowSurfacePlay";
import { ShadowSurfaceMount } from "./withShadowSurface";

const meta = {
  title: "Features/Extension/Shadow surface",
  decorators: [(Story) => <ShadowSurfaceMount Story={Story} />],
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;

type Story = StoryObj<typeof meta>;

export const Typography: Story = {
  render: () => (
    <Text as="div" size="sm-loose" weight="semibold">
      <Heading data-testid="nested-heading" size="large">
        Heading
      </Heading>
      <Text data-testid="nested-body" size="medium">
        Body
      </Text>
      <Text data-testid="same-element-leading" size="sm-loose">
        Leading override
      </Text>
      <Text data-testid="same-element-weight" size="medium" weight="semibold">
        Weight override
      </Text>
    </Text>
  ),
};

export const TooltipOpen: Story = {
  render: () => (
    <TooltipProvider delayDuration={0}>
      <Tooltip open>
        <TooltipTrigger>Selected word</TooltipTrigger>
        <TooltipContent>The dictionary entry opens here.</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
  play: withShadowRootPlay(),
};
