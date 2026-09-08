import type { Meta, StoryObj } from '@storybook/react';

import { SessionControl } from './SessionControl';

const meta: Meta<typeof SessionControl> = {
  title: 'Common/SessionControl',
  component: SessionControl,
};

export default meta;
type Story = StoryObj<typeof SessionControl>;

export const Default: Story = {
  args: {
    children: 'Session controls',
  },
};
