import type { Meta, StoryObj } from '@storybook/react';

import { InflectionTable } from './InflectionTable';

const meta = {
  title: 'Flashcard/InflectionTable',
  component: InflectionTable,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof InflectionTable>;
export default meta;

type Story = StoryObj<typeof meta>;
const mockNounForms = [
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
const mockAdjectiveForms = [
  {
    id: 5,
    form: 'fin',
    tags_json: ['Pos', 'Masc', 'Ind', 'Sing'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
  {
    id: 6,
    form: 'fint',
    tags_json: ['Pos', 'Neuter', 'Ind', 'Sing'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
  {
    id: 7,
    form: 'fine',
    tags_json: ['Pos', 'Plur'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
  {
    id: 8,
    form: 'finere',
    tags_json: ['Cmp'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
  {
    id: 9,
    form: 'finest',
    tags_json: ['Sup', 'Ind'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
  {
    id: 10,
    form: 'fineste',
    tags_json: ['Sup', 'Def'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
];
const mockAdverbForms = [
  {
    id: 11,
    form: 'fort',
    tags_json: ['Pos'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
  {
    id: 12,
    form: 'fortere',
    tags_json: ['Cmp'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
  {
    id: 13,
    form: 'fortest',
    tags_json: ['Sup'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
];
const mockVerbForms = [
  {
    id: 22,
    form: 'kaste',
    tags_json: ['Inf'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
  {
    id: 23,
    form: 'kaster',
    tags_json: ['Pres'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
  {
    id: 24,
    form: 'kastet',
    tags_json: ['Past'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
  {
    id: 25,
    form: 'kastet',
    tags_json: ['<PerfPart>'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
  {
    id: 26,
    form: 'kast',
    tags_json: ['Imp'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
];
const mockDualGenderNounForms = [
  {
    id: 14,
    form: 'sol',
    tags_json: ['Masc', 'Sing', 'Ind'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
  {
    id: 15,
    form: 'solen',
    tags_json: ['Masc', 'Sing', 'Def'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
  {
    id: 16,
    form: 'soler',
    tags_json: ['Masc', 'Plur', 'Ind'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
  {
    id: 17,
    form: 'solene',
    tags_json: ['Masc', 'Plur', 'Def'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
  {
    id: 18,
    form: 'sol',
    tags_json: ['Fem', 'Sing', 'Ind'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
  {
    id: 19,
    form: 'sola',
    tags_json: ['Fem', 'Sing', 'Def'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
  {
    id: 20,
    form: 'soler',
    tags_json: ['Fem', 'Plur', 'Ind'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
  {
    id: 21,
    form: 'solene',
    tags_json: ['Fem', 'Plur', 'Def'],
    ipa: null,
    audio_url: null,
    ipa_approximate: false,
  },
];
export const Noun: Story = {
  args: {
    wordForms: mockNounForms,
  },
};
export const NounDualGender: Story = {
  args: {
    wordForms: mockDualGenderNounForms,
  },
};
export const Adjective: Story = {
  args: {
    wordForms: mockAdjectiveForms,
  },
};
export const Adverb: Story = {
  args: {
    wordForms: mockAdverbForms,
  },
};
export const Verb: Story = {
  args: {
    wordForms: mockVerbForms,
    pos: 'verb',
  },
};
export const NounAuto: Story = {
  name: 'Noun: Auto Layout',
  args: {
    wordForms: mockNounForms,
    layout: 'auto',
  },
};
export const NounHorizontal: Story = {
  name: 'Noun: Horizontal Layout',
  args: {
    wordForms: mockNounForms,
    layout: 'horizontal',
  },
};
export const NounVertical: Story = {
  name: 'Noun: Vertical Layout',
  args: {
    wordForms: mockNounForms,
    layout: 'vertical',
  },
};
export const AdjectiveAuto: Story = {
  name: 'Adjective: Auto Layout',
  args: {
    wordForms: mockAdjectiveForms,
    layout: 'auto',
  },
};
export const VerbAuto: Story = {
  name: 'Verb: Auto Layout',
  args: {
    wordForms: mockVerbForms,
    pos: 'verb',
    layout: 'auto',
  },
};
