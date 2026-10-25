import { Text } from '@flyt/ui';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import { FlashCardFrame } from './FlashCardFrame';

const meta = {
  title: 'Features/Flashcard/FlashCardFrame',
  component: FlashCardFrame,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof FlashCardFrame>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Passive flashcard',
    footer: (
      <div className="px-1">
        <Text as="p" size="medium">
          Footer content
        </Text>
      </div>
    ),
    children: <Text size="large">Flashcard content</Text>,
  },
  render: (args) => (
    <div className="h-96 w-[28rem] max-w-full">
      <FlashCardFrame {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const footer = within(canvasElement).getByTestId('flashcard-footer-bar');
    const view = canvasElement.ownerDocument.defaultView;
    if (!view) throw new Error('Storybook document has no window');

    await expect(view.getComputedStyle(footer).borderTopWidth).toBe('1px');
  },
};
