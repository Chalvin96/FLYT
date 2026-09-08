import type { Meta, StoryObj } from '@storybook/react';

import { Button } from '@/components/common/Button/Button';

import { Modal } from './Modal';

const meta = {
  title: 'Common/Modal',
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
      <p className="text-sm text-muted-foreground">Card: Verb forms #12</p>
    ),
    footer: (
      <>
        <Button variant="outline">Cancel</Button>
        <Button variant="destructive">Delete</Button>
      </>
    ),
  },
};
export const Large: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    size: 'lg',
    title: 'Session summary',
    children: (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>Reviewed: 34 cards</p>
        <p>Correct: 28</p>
        <p>Streak: 12</p>
      </div>
    ),
  },
};
