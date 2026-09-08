import type { Meta, StoryObj } from '@storybook/react';

import type { DefinitionPayload, UserCard } from '@/types/api';

import { FlashCardDefinition } from './FlashCardDefinition';

const meta = {
  title: 'Flashcard/FlashCardDefinition',
  component: FlashCardDefinition,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div
        className="flex flex-col px-4 pb-0 pt-4"
        style={{ height: '100dvh' }}
      >
        <Story />
      </div>
    ),
  ],
  parameters: { layout: 'fullscreen' },
  args: { className: 'flex-1' },
} satisfies Meta<typeof FlashCardDefinition>;

export default meta;

type Story = StoryObj<typeof meta>;
type DefinitionCard = Extract<UserCard['card'], { type: 'definition' }>;
type DefinitionUserCard = Omit<UserCard, 'card'> & { card: DefinitionCard };

function makeDefinitionCard(
  id: number,
  payload: DefinitionPayload,
): DefinitionUserCard {
  return {
    id,
    user_id: 1,
    pool_id: id,
    card: {
      id,
      type: 'definition',
      deck_id: null,
      payload,
    },
    fsrs_stability: null,
    fsrs_difficulty: null,
    fsrs_step: null,
    last_review_at: null,
    due_at: '2026-02-20T10:00:00Z',
    state: 'review',
  };
}

const nounCard = makeDefinitionCard(1, {
  word: 'hund',
  pos: 'noun',
  primary_translation: 'A dog (animal with four legs that barks)',
  definitions: [
    {
      uuid: 'def-hund-1',
      definition: 'dog (animal with four legs that barks)',
      translation: 'A dog (animal with four legs that barks)',
      examples_json: [
        { no: 'Jeg har en liten hund.', en: 'I have a small dog.' },
        { no: 'Hunden løper raskt.', en: null },
      ],
    },
  ],
});

const nounWordForms = [
  {
    id: 1,
    form: 'hund',
    tags_json: ['Masc', 'Sing', 'Ind'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
  {
    id: 2,
    form: 'hunden',
    tags_json: ['Masc', 'Sing', 'Def'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
  {
    id: 3,
    form: 'hunder',
    tags_json: ['Masc', 'Plur', 'Ind'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
  {
    id: 4,
    form: 'hundene',
    tags_json: ['Masc', 'Plur', 'Def'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
];

const verbCard = makeDefinitionCard(2, {
  word: 'kaste',
  pos: 'verb',
  primary_translation: 'throw; cast',
  definitions: [
    {
      uuid: 'def-kaste-1',
      definition: 'throw; cast',
      translation: 'throw; cast',
      examples_json: [{ no: 'Han kastet ballen til meg.', en: null }],
    },
  ],
});

const verbWordForms = [
  {
    id: 16,
    form: 'kaste',
    tags_json: ['Inf'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
  {
    id: 17,
    form: 'kaster',
    tags_json: ['Pres'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
  {
    id: 18,
    form: 'kastet',
    tags_json: ['Past'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
  {
    id: 19,
    form: 'kastet',
    tags_json: ['<PerfPart>'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
  {
    id: 20,
    form: 'kast',
    tags_json: ['Imp'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
];

const adjectiveCard = makeDefinitionCard(3, {
  word: 'usaklig',
  pos: 'adjective',
  primary_translation: 'unreasonable; not based on facts or logic',
  definitions: [
    {
      uuid: 'def-usaklig-1',
      definition: 'unreasonable; not based on facts or logic',
      translation: 'unreasonable; not based on facts or logic',
      examples_json: [{ no: 'Det var en usaklig kommentar.', en: null }],
    },
  ],
});

const adjectiveWordForms = [
  {
    id: 9,
    form: 'usaklig',
    tags_json: ['Pos', 'Masc/Fem', 'Ind', 'Sing'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
  {
    id: 10,
    form: 'usaklig',
    tags_json: ['Pos', 'Neuter', 'Ind', 'Sing'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
  {
    id: 11,
    form: 'usaklige',
    tags_json: ['Pos', 'Plur'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
  {
    id: 12,
    form: 'usaklige',
    tags_json: ['Pos', 'Def', 'Sing'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
  {
    id: 13,
    form: 'usakligere',
    tags_json: ['Cmp'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
  {
    id: 14,
    form: 'usakligst',
    tags_json: ['Sup', 'Ind'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
  {
    id: 15,
    form: 'usakligste',
    tags_json: ['Sup', 'Def'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
];

export const Default: Story = {
  args: {
    card: nounCard,
    onFinished: () => undefined,
  },
};

export const NoAlternatives: Story = {
  args: {
    card: nounCard,
    onFinished: () => undefined,
  },
};

export const NoExamples: Story = {
  args: {
    card: {
      ...nounCard,
      card: {
        ...nounCard.card,
        payload: {
          ...nounCard.card.payload,
          definitions: [
            {
              ...nounCard.card.payload.definitions[0],
              examples_json: [],
            },
          ],
        },
      },
    },
    onFinished: () => undefined,
  },
};

export const NoTranslation: Story = {
  args: {
    card: makeDefinitionCard(4, {
      word: 'test',
      pos: 'noun',
      primary_translation: '',
      definitions: [
        {
          uuid: 'def-test-1',
          definition: 'test definition',
          translation: '',
          examples_json: [{ no: 'Dette er et eksempel.', en: null }],
        },
      ],
    }),
    onFinished: () => undefined,
  },
};

export const WithNounInflection: Story = {
  name: 'With Noun Inflection Table',
  args: {
    card: nounCard,
    wordForms: nounWordForms,
    onFinished: () => undefined,
  },
};

export const WithAdjectiveInflection: Story = {
  name: 'With Adjective Inflection Table',
  args: {
    card: adjectiveCard,
    wordForms: adjectiveWordForms,
    onFinished: () => undefined,
  },
};

export const FlashcardNoun: Story = {
  name: 'Flashcard: Noun',
  args: {
    card: nounCard,
    wordForms: nounWordForms,
    onFinished: () => undefined,
  },
  parameters: {
    viewport: { defaultViewport: 'desktop' },
  },
};

export const FlashcardVerb: Story = {
  name: 'Flashcard: Verb',
  args: {
    card: verbCard,
    wordForms: verbWordForms,
    onFinished: () => undefined,
  },
  parameters: {
    viewport: { defaultViewport: 'desktop' },
  },
};

export const FlashcardAdjective: Story = {
  name: 'Flashcard: Adjective',
  args: {
    card: adjectiveCard,
    wordForms: adjectiveWordForms,
    onFinished: () => undefined,
  },
  parameters: {
    viewport: { defaultViewport: 'desktop' },
  },
};
