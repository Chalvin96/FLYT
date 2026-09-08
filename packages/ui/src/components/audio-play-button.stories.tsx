import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import { AudioPlayButton } from './audio-play-button';

const fixtureAudio =
  'data:audio/wav;base64,UklGRhQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

const meta = {
  title: 'Controls/AudioPlayButton',
  component: AudioPlayButton,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  args: {
    src: fixtureAudio,
    label: 'Play example sentence',
  },
} satisfies Meta<typeof AudioPlayButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Inline: Story = {};

export const Standalone: Story = {
  args: { tone: 'standalone', label: 'Play pronunciation' },
};

export const Compact: Story = {
  args: { tone: 'compact', size: 'md', label: 'Play pronunciation' },
};

export const CompactSmall: Story = {
  args: { tone: 'compact', size: 'sm', label: 'Play pronunciation' },
};

export const Unavailable: Story = {
  args: {
    src: null,
    unavailableLabel: 'Audio unavailable for this example',
  },
};

export const UnavailableCompact: Story = {
  args: {
    src: null,
    tone: 'compact',
    unavailableLabel: 'Audio unavailable for this example',
  },
};

export const Error: Story = {
  args: {
    src: 'data:audio/wav;base64,AAAA',
    label: 'Retry example sentence',
    errorLabel: 'Audio failed; retry',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Activate the control to inspect the retryable playback-error state.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    await userEvent.click(button);
    await expect(button).toHaveAttribute('data-state', 'error');
  },
};

export const Narrow: Story = {
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
};
