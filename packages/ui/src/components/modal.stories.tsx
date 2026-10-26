import type { Meta, StoryObj } from '@storybook/react';

import { Button } from './button';
import { Modal } from './modal';
import { Text } from './text';

const meta = {
  title: 'Design system/Overlays/Modal',
  component: Modal,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    onClose: { action: 'close' },
    children: { control: false },
    footer: { control: false },
  },
} satisfies Meta<typeof Modal>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    title: 'Delete card?',
    description: 'This action cannot be undone.',
    children: (
      <Text as="p" size="medium" tone="subtle">
        Card: Verb forms #12
      </Text>
    ),
    footer: (
      <>
        <Button variant="outline">Cancel</Button>
        <Button variant="danger">Delete</Button>
      </>
    ),
  },
};
