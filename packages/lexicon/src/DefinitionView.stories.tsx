import { Text } from '@flyt/ui';
import type { Meta, StoryObj } from '@storybook/react';

import { DefinitionView } from './DefinitionView';
import type { DefinitionRead, WordFormRead } from './types';

const meta = {
  title: 'Features/Lexicon/DefinitionView',
  component: DefinitionView,
  tags: ['autodocs'],
  argTypes: {
    definition: {
      control: 'object',
      description: 'Definition data to display',
    },
    isAdded: {
      control: 'boolean',
      description: 'Whether definition is added to deck',
    },
    isAdding: {
      control: 'boolean',
      description: 'Whether adding is in progress',
    },
    onAddToDeck: {
      action: 'onAddToDeck',
      description: 'Called when user clicks add to deck',
    },
  },
} satisfies Meta<typeof DefinitionView>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockDefinition: DefinitionRead = {
  uuid: 'definition-1',
  id: 1,
  definition: 'dyr med fire ben som bjeff',
  examples_json: [
    { no: 'Jeg har en liten hund.', en: 'I have a small dog.' },
    { no: 'Hunden løper raskt.', en: null },
  ],
  translation_source: '',
  translation: 'A dog (animal with four legs that barks)',
};

export const Default: Story = {
  args: {
    definition: mockDefinition,
    onAddToDeck: undefined,
  },
};

export const NoExamples: Story = {
  args: {
    definition: {
      ...mockDefinition,
      examples_json: [],
    },
  },
};

export const NoTranslation: Story = {
  args: {
    definition: {
      uuid: 'definition-2',
      id: 2,
      definition: 'en test definisjon',
      examples_json: [{ no: 'Dette er et eksempel.', en: null }],
      translation_source: '',
      translation: '',
    },
  },
};

export const WithButton: Story = {
  args: {
    definition: mockDefinition,
    onAddToDeck: () => alert('Added to deck!'),
  },
};

export const AlreadyAdded: Story = {
  args: {
    definition: mockDefinition,
    isAdded: true,
  },
};

export const Loading: Story = {
  args: {
    definition: mockDefinition,
    onAddToDeck: () => {},
    isAdding: true,
  },
};

export const WithNounInflection: Story = {
  name: 'With Noun Inflection Slot',
  args: {
    definition: mockDefinition,
    wordForms: [
      { id: 1, form: 'hund', tags_json: ['Masc', 'Sing', 'Ind'] },
      { id: 2, form: 'hunden', tags_json: ['Masc', 'Sing', 'Def'] },
      { id: 3, form: 'hunder', tags_json: ['Masc', 'Plur', 'Ind'] },
      { id: 4, form: 'hundene', tags_json: ['Masc', 'Plur', 'Def'] },
    ] as WordFormRead[],
    inflection: (
      <Text as="div" size="medium" tone="subtle">
        [Inflection table renders here in the app]
      </Text>
    ),
  },
};

export const LexiconDefault: Story = {
  name: 'Lexicon: Default (auto presentation)',
  args: {
    definition: mockDefinition,
    onAddToDeck: () => undefined,
  },
};

export const FlashcardVariant: Story = {
  name: 'Flashcard presentation (Examples below md)',
  args: {
    definition: mockDefinition,
    presentation: 'flashcard',
  },
};
