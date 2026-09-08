import { LemmaHeader } from '@flyt/lexicon';
import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'Lexicon/LemmaHeader',
  component: LemmaHeader,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
  args: {
    word: 'hund',
    pos: 'noun',
  },
} satisfies Meta<typeof LemmaHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NoPronunciation: Story = {};

export const WithIpa: Story = {
  args: { ipa: 'hʊn' },
};

export const Tone1: Story = {
  args: { ipa: 'hʊn', intonation: '1' },
};

export const Tone2: Story = {
  args: { ipa: 'hʊn', intonation: '2' },
};

export const WithAudio: Story = {
  args: {
    ipa: 'hʊn',
    intonation: '1',
    audioUrl: 'https://example.com/hund.mp3',
  },
};

export const Verb: Story = {
  args: {
    word: 'løpe',
    pos: 'verb',
    ipa: 'ˈløːpə',
    intonation: '2',
    audioUrl: 'https://example.com/lope.mp3',
  },
};

export const LongWord: Story = {
  args: {
    word: 'jernbanestasjonen',
    pos: 'noun',
    ipa: 'ˈjæːɾnˌbɑːnəˌstɑːʃuːnən',
    intonation: '2',
    audioUrl: 'https://example.com/jernbanestasjonen.mp3',
  },
};

export const FlashcardBack: Story = {
  name: 'As flashcard back (h2)',
  args: {
    word: 'huset',
    pos: 'noun',
    ipa: 'ˈhuːsɛt',
    intonation: '2',
    audioUrl: 'https://example.com/huset.mp3',
    headingAs: 'h2',
    headingClassName:
      'type-display-lg break-words font-display leading-none text-secondary-90',
  },
};
