import type { Meta, StoryObj } from '@storybook/react';

import { WordFormChip } from './WordFormChip';

const meta = {
  title: 'Lexicon/WordFormChip',
  component: WordFormChip,
  tags: ['autodocs'],
  argTypes: {
    form: {
      control: 'text',
      description: 'Word form to display',
    },
    tags: {
      control: 'object',
      description: 'Grammatical tags',
    },
    variant: {
      control: 'select',
      options: ['default', 'highlight'],
      description: 'Variant style',
    },
  },
} satisfies Meta<typeof WordFormChip>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    form: 'hunder',
    tags: ['plural', 'indefinite'],
  },
};
export const Highlight: Story = {
  args: {
    form: 'hunden',
    tags: ['singular', 'definite'],
    variant: 'highlight',
  },
};
export const MultipleTags: Story = {
  args: {
    form: 'båt',
    tags: ['masculine', 'singular', 'indefinite', 'indefinite form'],
  },
};
export const Simple: Story = {
  args: {
    form: 'hund',
    tags: ['base form'],
  },
};
