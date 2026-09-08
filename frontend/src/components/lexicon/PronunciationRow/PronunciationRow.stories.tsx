import { PronunciationRow } from '@flyt/lexicon';
import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'Lexicon/PronunciationRow',
  component: PronunciationRow,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof PronunciationRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const IpaOnly: Story = {
  args: { ipa: 'hʊn' },
};

export const Tone1: Story = {
  args: { intonation: '1' },
};

export const Tone2: Story = {
  args: { intonation: '2' },
};

export const AudioOnly: Story = {
  args: { audioUrl: 'https://example.com/hund.mp3' },
};

export const Full: Story = {
  args: {
    ipa: 'hʊn',
    intonation: '1',
    audioUrl: 'https://example.com/hund.mp3',
  },
};

export const FullTone2: Story = {
  args: {
    ipa: 'ˈhuːsɛt',
    intonation: '2',
    audioUrl: 'https://example.com/huset.mp3',
  },
};

export const SmallSize: Story = {
  args: {
    ipa: 'hʊn',
    intonation: '1',
    audioUrl: 'https://example.com/hund.mp3',
    size: 'sm',
  },
};

export const Approximate: Story = {
  name: 'Approximate IPA (auto-generated)',
  args: {
    ipa: 'hʊn',
    intonation: '1',
    ipaApproximate: true,
  },
};

export const ApproximateNoTone: Story = {
  name: 'Approximate IPA, no tone data',
  args: {
    ipa: 'ˈhuːsɛt',
    ipaApproximate: true,
  },
};

export const AllNull: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Returns null — renders nothing when all props absent.',
      },
    },
  },
};
