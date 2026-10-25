import type { Meta, StoryObj } from '@storybook/react';

import { Heading } from './heading';
import { Text } from './text';
import { HEADING_ROLE_DOCS } from '../foundations/token-docs';

const meta = {
  title: 'Design system/Typography/Heading',
  component: Heading,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: {
    children: 'Read Norwegian you love',
    size: 'medium',
  },
} satisfies Meta<typeof Heading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sizes: Story = {
  render: () => (
    <div className="grid gap-5">
      {HEADING_ROLE_DOCS.map(({ size, useWhen }) => (
        <div className="grid gap-1" key={size}>
          <Text as="code" font="mono" size="small">
            {`Heading size="${size}"`}
          </Text>
          <Heading as="h2" size={size}>
            {size === 'xxsmall' ? 'Section label' : 'Read Norwegian you love'}
          </Heading>
          <Text size="small" tone="subtle">
            {useWhen}
          </Text>
        </div>
      ))}
    </div>
  ),
};
