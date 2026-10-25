import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@flyt/ui';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn } from 'storybook/test';
import { useRef } from 'react';

import { FlytChatbotPanel } from './FlytChatbotPanel';

const panelArgs = {
  surface: 'pane' as const,
  onClose: fn(),
  onContextRemove: fn(),
  onErrorDismiss: fn(),
  onErrorRetry: fn(),
  onModelChange: fn(),
  onNewConversation: fn(),
  onSend: fn(),
  onFollowUpSelect: fn(),
  onStarterSelect: fn(),
};

function MobileChatbotDialogSurface() {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <Dialog open>
      <DialogContent
        aria-describedby="flyt-chatbot-mobile-description"
        aria-labelledby="flyt-chatbot-mobile-title"
        aria-modal="true"
        id="flyt-chatbot-mobile"
        mobileOnly
        padding="none"
        showClose={false}
        variant="fullscreen"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          contentRef.current
            ?.querySelector<HTMLTextAreaElement>('textarea')
            ?.focus();
        }}
        ref={contentRef}
      >
        <DialogTitle id="flyt-chatbot-mobile-title" visuallyHidden>
          Ask Flyt
        </DialogTitle>
        <DialogDescription id="flyt-chatbot-mobile-description" visuallyHidden>
          Ask questions about Norwegian and the current page.
        </DialogDescription>
        <FlytChatbotPanel {...panelArgs} />
      </DialogContent>
    </Dialog>
  );
}

const meta = {
  title: 'Features/Chatbot/Mobile dialog',
  component: FlytChatbotPanel,
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'mobile1' },
  },
  render: () => <MobileChatbotDialogSurface />,
} satisfies Meta<typeof FlytChatbotPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullscreenBelowDesktop: Story = {
  play: async () => {
    await expect(document.getElementById('flyt-chatbot-mobile')).not.toBeNull();
  },
};
