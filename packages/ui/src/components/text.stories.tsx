import type { Meta, StoryObj } from '@storybook/react';

import { Heading } from './heading';
import { Text } from './text';
import {
  TEXT_FONT,
  TEXT_TONE,
  TEXT_WEIGHT,
  type TextFont,
  type TextTone,
  type TextWeight,
} from './text-variants';
import { BODY_ROLE_DOCS } from '../foundations/token-docs';

const meta = {
  title: 'Design system/Typography/Text',
  component: Text,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: {
    children: 'Learning Norwegian, one sentence at a time',
    size: 'medium',
  },
} satisfies Meta<typeof Text>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sizes: Story = {
  render: () => (
    <div className="grid gap-5">
      {BODY_ROLE_DOCS.map(({ size, useWhen }) => (
        <div className="grid gap-1" key={size}>
          <Text as="code" font="mono" size="small">
            {`Text size="${size}"`}
          </Text>
          <Text size={size}>Learning Norwegian, one sentence at a time.</Text>
          <Text size="small" tone="subtle">
            {useWhen}
          </Text>
        </div>
      ))}
    </div>
  ),
};

const TONES = Object.keys(TEXT_TONE) as TextTone[];

export const Tones: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-2">
      {TONES.map((tone) => (
        <Text as="div" key={tone} size="small" tone={tone}>
          {tone}
        </Text>
      ))}
    </div>
  ),
};

const WEIGHTS = Object.keys(TEXT_WEIGHT) as TextWeight[];

export const Weights: Story = {
  render: () => (
    <div className="grid gap-2">
      {WEIGHTS.map((weight) => (
        <Text as="div" key={weight} size="large" weight={weight}>
          {`${weight} — ${TEXT_WEIGHT[weight]}`}
        </Text>
      ))}
    </div>
  ),
};

const FONTS = Object.keys(TEXT_FONT) as TextFont[];

export const Faces: Story = {
  render: () => (
    <div className="grid gap-2">
      <Text size="large">Body face</Text>
      {FONTS.map((font) => (
        <Text as="div" font={font} key={font} size="large">
          {`${font} — ${TEXT_FONT[font]}`}
        </Text>
      ))}
    </div>
  ),
};

export const Elements: Story = {
  render: () => (
    <div className="grid gap-3">
      <Heading as="h1" size="large">
        Page heading
      </Heading>
      <Heading as="h2" size="medium">
        Section heading
      </Heading>
      <Text as="p" size="medium" tone="subtle">
        Supporting paragraph.
      </Text>
      <Text as="p" size="medium">
        Body copy with{' '}
        <Text as="strong" size="medium" weight="semibold">
          strong
        </Text>{' '}
        and{' '}
        <Text as="em" size="medium">
          emphasis
        </Text>{' '}
        inside it.
      </Text>
      <Text as="code" font="mono" size="small" tone="subtle">
        hus
      </Text>
      <Text as="blockquote" size="large" tone="subtle">
        A quoted sentence.
      </Text>
    </div>
  ),
};
