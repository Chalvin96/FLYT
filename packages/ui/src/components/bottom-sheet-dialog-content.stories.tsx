import type { Meta, StoryObj } from '@storybook/react';

import { BottomSheetDialogContent } from './bottom-sheet-dialog-content';
import { Dialog } from './dialog';

const meta: Meta<typeof BottomSheetDialogContent> = {
  title: 'Design system/Overlays/Bottom sheet',
  component: BottomSheetDialogContent,
  render: (args) => (
    <Dialog open>
      <BottomSheetDialogContent {...args} />
    </Dialog>
  ),
};

export default meta;
type Story = StoryObj<typeof BottomSheetDialogContent>;

export const Default: Story = {
  args: {
    children: 'Bottom sheet content',
  },
};
