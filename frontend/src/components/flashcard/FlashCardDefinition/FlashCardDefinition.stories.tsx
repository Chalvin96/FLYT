import type { Meta, StoryObj } from '@storybook/react';

import type { DefinitionPayload, UserCard } from '@/types/api';

import { FlashCardDefinition } from './FlashCardDefinition';

const meta = {
  title: 'Flashcard/FlashCardDefinition',
  component: FlashCardDefinition,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      // Mirrors the review session page container so stories show the width
      // the card actually gets in the app.
      <div
        className="flex flex-col px-4 pb-4 pt-4 lg:px-6"
        style={{ height: '100dvh' }}
      >
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
          <Story />
        </div>
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
  ipa: 'hʉnː',
  intonation: '1',
  audio_url: 'data:audio/wav;base64,UklGRg==',
  primary_translation: 'A dog (animal with four legs that barks)',
  definitions: [
    {
      uuid: 'def-hund-1',
      definition: 'firbeint husdyr som bjeffer og ofte holdes som kjæledyr',
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
  ipa: 'ˈkɑstə',
  intonation: '2',
  audio_url: 'data:audio/wav;base64,UklGRg==',
  primary_translation: 'throw; cast',
  definitions: [
    {
      uuid: 'def-kaste-1',
      definition: 'slynge noe av sted med hånda eller med et redskap',
      translation: 'throw; cast',
      examples_json: [{ no: 'Han kastet ballen til meg.', en: null }],
    },
    {
      uuid: 'def-kaste-2',
      definition: 'kvitte seg med noe man ikke vil ha lenger',
      translation: 'throw away; discard',
      examples_json: [{ no: 'Kast de gamle avisene.', en: null }],
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
  ipa: 'ˈʉːsɑːklɪ',
  ipa_approximate: true,
  intonation: '2',
  audio_url: 'data:audio/wav;base64,UklGRg==',
  primary_translation: 'unreasonable; not based on facts or logic',
  definitions: [
    {
      uuid: 'def-usaklig-1',
      definition: 'som ikke bygger på fakta eller fornuftige grunner',
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

const expressionCard = {
  ...makeDefinitionCard(5, {
    word: 'få [noe] i stand',
    pos: 'expression',
    primary_display_form: 'få i stand',
    alternative_forms: ['stelle i stand', 'lage i stand'],
    ipa: 'foː iː stɑn',
    ipa_approximate: true,
    intonation: '2',
    audio_url: 'data:audio/wav;base64,UklGRg==',
    primary_translation: 'get something ready; put something in order',
    definitions: [
      {
        uuid: 'def-expression-1',
        definition: 'gjøre noe klart eller ordne det slik at det kan brukes',
        translation: 'get something ready; put something in order',
        examples_json: [],
      },
    ],
  }),
  context: {
    source_sentence: 'Vi må få alt i stand før gjestene kommer.',
    source_title: 'NRK – Nyheter',
  },
};

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

export const FlashcardExpression: Story = {
  name: 'Flashcard: Expression',
  args: {
    card: expressionCard,
    onFinished: () => undefined,
  },
  parameters: {
    viewport: { defaultViewport: 'desktop' },
  },
};

export const TenMeanings: Story = {
  name: 'Stress: 10 meanings + saved context',
  args: {
    card: {
      ...makeDefinitionCard(10, {
        word: 'ta',
        pos: 'verb',
        ipa: 'tɑː',
        intonation: '1',
        audio_url: 'data:audio/wav;base64,UklGRg==',
        primary_translation: 'take; get; bring',
        definitions: [
          [
            'gripe, holde eller overta noe fysisk eller abstrakt, ofte på en måte som innebærer at personen får kontroll over det, flytter det fra ett sted til et annet eller påtar seg ansvaret for det i en større sammenheng',
            'take or hold something',
            'Etter at møtet hadde vart mye lenger enn planlagt, tok hun den tunge mappen med alle kontraktene, notatene og vedleggene fra det overfylte konferansebordet og bar den forsiktig tilbake til kontoret sitt.',
            'After the meeting had lasted much longer than planned, she took the heavy folder containing all the contracts, notes, and attachments from the crowded conference table and carefully carried it back to her office.',
          ],
          [
            'flytte noe med seg',
            'bring something along',
            'Kan du ta med boka?',
            'Can you bring the book?',
          ],
          [
            'velge eller bruke noe',
            'choose or use something',
            'Jeg tar den blå jakken.',
            'I’ll take the blue jacket.',
          ],
          [
            'motta noe',
            'receive something',
            'Hun tok imot pakken.',
            'She received the package.',
          ],
          [
            'reise med et transportmiddel',
            'travel by a form of transport',
            'Vi tar toget til Bergen.',
            'We’re taking the train to Bergen.',
          ],
          [
            'kreve en viss tid',
            'require a certain amount of time',
            'Det tar omtrent ti minutter.',
            'It takes about ten minutes.',
          ],
          [
            'fotografere eller filme',
            'photograph or film',
            'Han tok et bilde av utsikten.',
            'He took a picture of the view.',
          ],
          [
            'forstå eller oppfatte',
            'understand or perceive',
            'Jeg tok poenget med en gang.',
            'I understood the point immediately.',
          ],
          [
            'vinne eller beseire',
            'win or defeat',
            'Laget tok seieren til slutt.',
            'The team secured the victory in the end.',
          ],
          [
            'håndtere eller ordne',
            'handle or arrange something',
            'Kan du ta saken videre?',
            'Can you take the matter further?',
          ],
        ].map(([definition, translation, no, en], index) => ({
          uuid: `def-ta-${index + 1}`,
          definition,
          translation,
          examples_json: [{ no, en }],
        })),
      }),
      context: {
        source_sentence:
          'Da prosjektgruppen oppdaget at flere av de viktigste dokumentene fortsatt lå igjen på hovedkontoret, spurte lederen om noen kunne ta med både den oppdaterte kontrakten, de håndskrevne møtenotatene og den eksterne harddisken når de kom til arbeidsseminaret neste morgen, slik at teamet kunne fortsette gjennomgangen uten enda en forsinkelse.',
        source_title: 'Saved reading · Project planning notes',
      },
    },
    onFinished: () => undefined,
  },
};
