import type { Meta, StoryObj } from '@storybook/react';

import { SearchBar } from './SearchBar';

const meta = {
  title: 'Lexicon/SearchBar',
  component: SearchBar,
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: 'text',
      description: 'Current search query',
    },
    isLoading: {
      control: 'boolean',
      description: 'Loading state',
    },
    placeholder: {
      control: 'text',
      description: 'Input placeholder text',
    },
    onChange: {
      action: 'onChange',
      description: 'Called when input changes',
    },
    onSearch: {
      action: 'onSearch',
      description: 'Called when search is triggered',
    },
  },
} satisfies Meta<typeof SearchBar>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: '',
    onChange: (value) => console.log('onChange:', value),
    onSearch: (query) => console.log('onSearch:', query),
    placeholder: 'Search for a word...',
  },
};
export const WithValue: Story = {
  args: {
    value: 'hund',
    onChange: (value) => console.log('onChange:', value),
    onSearch: (query) => console.log('onSearch:', query),
  },
};
export const Loading: Story = {
  args: {
    value: 'hund',
    isLoading: true,
    onChange: (value) => console.log('onChange:', value),
    onSearch: (query) => console.log('onSearch:', query),
  },
};
export const ValidationError: Story = {
  args: {
    value: 'hello',
    onChange: (value) => console.log('onChange:', value),
    onSearch: (query) => console.log('onSearch:', query),
  },
};
export const WithNorwegianChars: Story = {
  args: {
    value: 'båt',
    onChange: (value) => console.log('onChange:', value),
    onSearch: (query) => console.log('onSearch:', query),
  },
};
