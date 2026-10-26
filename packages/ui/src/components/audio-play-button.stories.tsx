import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import { AudioPlayButton } from './audio-play-button';

const fixtureAudio =
  'data:audio/wav;base64,UklGRhQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

const meta = {
  title: 'Design system/Controls/AudioPlayButton',
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

export const Compact: Story = {
  args: { presentation: 'compact', size: 'md', label: 'Play pronunciation' },
};

export const CompactSmall: Story = {
  args: { presentation: 'compact', size: 'sm', label: 'Play pronunciation' },
};

export const Block: Story = {
  args: { presentation: 'block', label: 'Play the model' },
};

export const BlockHover: Story = {
  args: { presentation: 'block', label: 'Play the model' },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', {
      name: 'Play the model',
    });
    await userEvent.hover(button);
    await expect(button).toHaveAttribute('data-state', 'idle');
  },
};

export const BlockUnavailable: Story = {
  args: {
    src: null,
    presentation: 'block',
    label: 'Play the model',
    unavailableLabel: 'The model recording is not available yet',
  },
};

export const BlockError: Story = {
  args: {
    src: 'data:audio/wav;base64,AAAA',
    presentation: 'block',
    label: 'Play the model',
  },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', {
      name: 'Play the model',
    });
    await userEvent.click(button);
    await expect(button).toHaveAttribute('data-state', 'error');
    await expect(button).toHaveTextContent('Retry');
    await userEvent.unhover(button);
    button.blur();
  },
};

export const BlockPlaying: Story = {
  args: { presentation: 'block', label: 'Play the model' },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', {
      name: 'Play the model',
    });
    const originalAudio = window.Audio;
    class FakePlayingAudio extends EventTarget {
      play() {
        return new Promise<void>(() => {});
      }

      pause() {}
    }
    Object.defineProperty(window, 'Audio', {
      configurable: true,
      value: FakePlayingAudio,
    });
    try {
      await userEvent.click(button);
    } finally {
      Object.defineProperty(window, 'Audio', {
        configurable: true,
        value: originalAudio,
      });
    }
    await expect(button).toHaveAttribute('data-state', 'playing');
    await expect(button).toHaveTextContent('Playing');
    await expect(button.querySelectorAll('svg rect')).toHaveLength(2);
    await userEvent.unhover(button);
    button.blur();
  },
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
    presentation: 'compact',
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
