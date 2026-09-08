import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { Meta, StoryObj } from '@storybook/react';

import { BottomSheetDialogContent } from './BottomSheetDialogContent';

const meta: Meta<typeof BottomSheetDialogContent> = {
  title: 'Common/BottomSheetDialogContent',
  component: BottomSheetDialogContent,
  render: (args) => (
    <DialogPrimitive.Root open>
      <BottomSheetDialogContent {...args} />
    </DialogPrimitive.Root>
  ),
};

export default meta;
type Story = StoryObj<typeof BottomSheetDialogContent>;

export const Default: Story = {
  args: {
    children: 'Bottom sheet content',
  },
};
