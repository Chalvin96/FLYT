import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';

import { ChatbotProvider } from '@/components/chatbot/ChatbotProvider';
import { LookupProvider } from '@/components/lookup/LookupProvider';
import { ReaderDefinitionPanel } from '@/components/reading/ReaderDefinitionPanel';
import { ReaderLookupSheet } from '@/components/reading/ReaderLookupSheet';
import { ReaderWordLookup } from '@/components/reading/ReaderWordLookup';
import { lexiconKeys, type AddLemmasRequest } from '@/hooks/lexicon/queries';
import { createStoryRouter } from '@/test/router';
import type {
  ReadingLemmaDefinitionsResponse,
  ReadingStorySummary,
} from '@/types/api';

import type { StoryLookupWord, StoryVocabulary } from './storyCompletion';
import { StoryEndSection, type StoryEndSectionProps } from './StoryEndSection';
import { StoryReaderLayout } from './StoryReaderLayout';

const theme = {
  id: 1,
  key: 'daily_life',
  title: 'Hverdagsliv',
  order: 1,
  storyCount: 12,
};
const story = {
  title: 'En regnfull mandag',
  cefrLevel: 'A2',
  groupKey: theme.key,
  groupTitle: theme.title,
  totalPages: 5,
  readingMinutes: 5,
};
const summary = (
  uuid: string,
  title: string,
  cefrLevel: string,
  wordCount: number,
  completed = false,
): ReadingStorySummary => ({
  uuid,
  title,
  cefrLevel,
  wordCount,
  readingMinutes: 4,
  completed,
  isRead: completed,
  createdAt: '2026-10-01T00:00:00',
});
const next = summary('next', 'Ida på jobb', 'A2', 580);
const recommendations = [
  summary('boat', 'Den lille båten', 'A2', 410),
  summary('mai', 'Syttende mai', 'B1', 720),
  summary('shop', 'På butikken', 'A2', 300, true),
];
const vocabulary = (
  mastered: number,
  learning: number,
  newCount: number,
  wordCount: number,
): StoryVocabulary => ({
  mastered,
  learning,
  new: newCount,
  wordCount,
  states: new Map(),
});
const defaultNames = [
  'butikk',
  'trenge',
  'lommebok',
  'takke',
  'gammel',
  'foran',
];
const fortyNames =
  'kantine pult melding prosjekt lukte nybakt helg forstå møte frist kollega ansvar oppgave leder beskjed avdeling forslag utsette vedlegg levere budsjett avtale samtale erfaring skrivebord presentasjon tilbakemelding kunde oppdrag løsning planlegge endring vurdere sjef lønn ferie skift rapport telefonmøte overtid'.split(
    ' ',
  );
const lookups = (names: string[], newCount: number): StoryLookupWord[] =>
  names.map((dictionaryForm, index) => ({
    key: `lookup-${index}`,
    text: dictionaryForm === 'butikk' ? 'butikken' : dictionaryForm,
    dictionaryForm,
    lemmaUuid: `lemma-${dictionaryForm}`,
    state: index < newCount ? 'new' : 'learning',
    sentence: `Hun leser ordet ${dictionaryForm}.`,
    observedAt: 1,
  }));

function EndPreview(props: StoryEndSectionProps) {
  const queryClient = useQueryClient();
  const router = useMemo(() => {
    for (const word of props.lookups) {
      if (word.lemmaUuid === null) continue;
      const response: ReadingLemmaDefinitionsResponse = {
        lemma: {
          uuid: word.lemmaUuid,
          word: word.dictionaryForm,
          pos: 'noun',
          primary_translation:
            word.dictionaryForm === 'butikk' ? 'shop' : 'word',
          primary_display_form: word.dictionaryForm,
        },
        definitions: [
          {
            uuid: `definition-${word.lemmaUuid}`,
            definition: 'Dictionary meaning',
            translation: word.dictionaryForm === 'butikk' ? 'shop' : 'word',
            translation_source: null,
            examples: [],
            userState: word.state,
          },
        ],
      };
      queryClient.setQueryDefaults(
        lexiconKeys.lemmaDefinitions(word.lemmaUuid),
        { staleTime: Infinity },
      );
      queryClient.setQueryData(
        lexiconKeys.lemmaDefinitions(word.lemmaUuid),
        response,
      );
    }
    return createStoryRouter(
      <ChatbotProvider>
        <LookupProvider>
          <EndContent {...props} />
        </LookupProvider>
      </ChatbotProvider>,
      ['/reading/story/finished'],
      [
        '/reading',
        '/reading/imports',
        '/reading/story/$uuid',
        '/reading/themes/$key',
      ],
    );
  }, [props, queryClient]);
  return <RouterProvider router={router} />;
}

function EndContent(props: StoryEndSectionProps) {
  const [selected, setSelected] = useState<StoryLookupWord>();
  const returnFocusRef = useRef<HTMLElement>(null);
  const close = () => setSelected(undefined);
  const select = (word: StoryLookupWord) => {
    if (document.activeElement instanceof HTMLElement)
      returnFocusRef.current = document.activeElement;
    props.onLookup(word);
    setSelected(word);
  };
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-neutral text-default">
      <StoryReaderLayout
        title={props.story.title}
        finished
        rail={
          selected && (
            <ReaderDefinitionPanel
              words={[]}
              selectedWord={selected}
              onSelect={() => {}}
              onClose={close}
              wordListAvailable={false}
            />
          )
        }
      >
        <div className="mx-auto max-w-5xl">
          <StoryEndSection {...props} onLookup={select} />
        </div>
      </StoryReaderLayout>
      <ReaderLookupSheet
        open={selected !== undefined}
        title={selected?.dictionaryForm ?? 'Word lookup'}
        onClose={close}
        returnFocusRef={returnFocusRef}
      >
        {selected && <ReaderWordLookup word={selected} onClose={close} />}
      </ReaderLookupSheet>
    </div>
  );
}

const meta = {
  title: 'Features/Reading/Story end',
  component: EndPreview,
  parameters: { layout: 'fullscreen' },
  args: {
    story,
    wordCount: 640,
    vocabulary: vocabulary(172, 22, 16, 640),
    lookups: lookups(defaultNames, 4),
    continuation: { kind: 'next', theme, story: next },
    otherThemes: [],
    recommendations,
    onLookup: fn(),
    onAddWords: fn(async ({ lemmaUuids, onProgress }: AddLemmasRequest) => {
      lemmaUuids.forEach((_, index) =>
        onProgress(index + 1, lemmaUuids.length),
      );
      return { added: [...lemmaUuids], failed: [] };
    }),
  },
} satisfies Meta<typeof EndPreview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const NoData: Story = {
  args: {
    vocabulary: undefined,
    lookups: [],
    continuation: { kind: 'none' },
    recommendations: [],
    wordCount: undefined,
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).queryByText(/looked up/),
    ).not.toBeInTheDocument();
  },
};
export const ZeroLookups: Story = {
  args: {
    story: {
      ...story,
      title: 'Ida sin dag',
      cefrLevel: 'A1',
      totalPages: 3,
      readingMinutes: 2,
    },
    wordCount: 260,
    vocabulary: vocabulary(96, 0, 0, 260),
    lookups: [],
    continuation: {
      kind: 'next',
      theme,
      story: summary('next', 'Ida handler', 'A1', 290),
    },
    recommendations: [recommendations[1], recommendations[0]],
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('You know every word in this story.'),
    ).toBeVisible();
  },
};
export const OneLookup: Story = {
  args: {
    story: {
      ...story,
      title: 'Kaffe',
      cefrLevel: 'A1',
      totalPages: 1,
      readingMinutes: 1,
    },
    wordCount: 48,
    vocabulary: vocabulary(33, 2, 1, 48),
    lookups: lookups(['kopp'], 1),
    continuation: {
      kind: 'next',
      theme,
      story: summary('next', 'Frokost', 'A1', 62),
    },
    recommendations: [summary('day', 'Ida sin dag', 'A1', 260)],
  },
};
export const FortyLookups: Story = {
  args: {
    story: {
      ...story,
      title: 'Et nytt prosjekt',
      cefrLevel: 'B1',
      groupKey: 'work',
      groupTitle: 'Arbeidsliv',
      totalPages: 9,
      readingMinutes: 13,
    },
    wordCount: 1840,
    vocabulary: vocabulary(281, 79, 160, 1840),
    lookups: lookups(fortyNames, 31).map((word) => ({
      ...word,
      state: [
        'møte',
        'kollega',
        'helg',
        'forstå',
        'leder',
        'ferie',
        'sjef',
        'lønn',
        'kunde',
      ].includes(word.dictionaryForm)
        ? 'learning'
        : 'new',
    })),
    continuation: {
      kind: 'next',
      theme: { ...theme, key: 'work', title: 'Arbeidsliv' },
      story: summary('next', 'Første dag på kontoret', 'B1', 1210),
    },
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'Show all 40' }),
    ).toBeVisible();
  },
};
export const NothingMastered: Story = {
  args: {
    story: {
      ...story,
      title: 'Hei, jeg heter Ida',
      cefrLevel: 'A1',
      totalPages: 2,
      readingMinutes: 2,
    },
    wordCount: 180,
    vocabulary: vocabulary(0, 0, 74, 180),
    lookups: lookups(
      [
        'heter',
        'bo',
        'jobbe',
        'sykepleier',
        'gift',
        'barn',
        'hund',
        'glad',
        'også',
      ],
      9,
    ),
    continuation: {
      kind: 'next',
      theme,
      story: summary('next', 'Ida sin dag', 'A1', 260),
    },
    recommendations: [
      summary('shop', 'Ida handler', 'A1', 290),
      summary('store', 'På butikken', 'A2', 300),
    ],
  },
};
export const LastInTheme: Story = {
  args: {
    continuation: { kind: 'last', theme, allRead: true },
    otherThemes: [
      {
        id: 2,
        key: 'folk',
        title: 'Folk tales and stories',
        order: 2,
        storyCount: 9,
      },
      {
        id: 3,
        key: 'culture',
        title: 'Culture and society',
        order: 3,
        storyCount: 14,
      },
    ],
    recommendations: recommendations.slice(0, 2),
  },
};
export const Import: Story = {
  args: {
    story: {
      title: 'Været i helgen',
      cefrLevel: null,
      groupKey: null,
      groupTitle: null,
      totalPages: 3,
      readingMinutes: 4,
    },
    wordCount: 520,
    vocabulary: vocabulary(139, 21, 28, 520),
    lookups: lookups(['regnbyge', 'vindkast', 'varsle', 'kuling', 'pent'], 4),
    continuation: { kind: 'none' },
  },
};
export const ReopenLookup: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Look up butikk' }),
    );
    await expect(
      within(document.body).getByRole('heading', { name: 'butikk', level: 3 }),
    ).toBeVisible();
  },
};
export const AddToReview: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', {
        name: 'Add 4 new words to review',
      }),
    );
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent(
      'Added 4 words to review.',
    );
  },
};
