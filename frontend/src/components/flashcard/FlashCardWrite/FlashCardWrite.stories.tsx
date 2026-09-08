import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import type { WriteExercise, WriteJudgement } from '@/types/lesson-contracts';

import { FlashCardWrite } from './FlashCardWrite';

const exercise: WriteExercise = {
  kind: 'exercise',
  objective_id: 'obj-1',
  id: 'story-write-01',
  operation: 'write',
  prompt: [{ kind: 'text', value: 'Describe your morning routine.' }],
  explanation: [
    {
      kind: 'text',
      value:
        'A good answer anchors the routine in time with present-tense verbs.',
    },
  ],
  payload: {
    response_language: 'no',
    min_words: 20,
    max_words: 35,
    judge_prompt:
      'Check the response against the task and report evidence for each criterion.',
    criteria: [
      {
        id: 'main-point',
        instruction: 'States the main point in natural Norwegian.',
      },
      {
        id: 'present-tense',
        instruction: 'Uses present-tense verbs consistently.',
      },
      {
        id: 'time-markers',
        instruction: 'Includes at least two time expressions.',
      },
    ],
  },
};

const sample =
  'Jeg står opp klokka sju hver dag. Først dusjer jeg og spiser frokost på kjøkkenet. ' +
  'Deretter tar jeg bussen til jobben klokka åtte.';

const allMet: WriteJudgement = {
  criteria: [
    {
      criterion_id: 'main-point',
      met: true,
      evidence: 'Jeg står opp klokka sju hver dag.',
    },
    {
      criterion_id: 'present-tense',
      met: true,
      evidence: 'dusjer, spiser, tar',
    },
    {
      criterion_id: 'time-markers',
      met: true,
      evidence: 'klokka sju … klokka åtte',
    },
  ],
};

const partial: WriteJudgement = {
  criteria: [
    {
      criterion_id: 'main-point',
      met: true,
      evidence: 'Jeg står opp klokka sju hver dag.',
    },
    {
      criterion_id: 'present-tense',
      met: false,
      evidence: 'Deretter tok jeg bussen til jobben.',
    },
    {
      criterion_id: 'time-markers',
      met: true,
      evidence: 'klokka sju … klokka åtte',
    },
  ],
};

const unbounded: WriteExercise = {
  ...exercise,
  id: 'story-write-unbounded',
  prompt: [
    {
      kind: 'text',
      value:
        'Write two Norwegian ordering sentences. Replace the coffee and cinnamon bun with two different café items taught in this lesson. Use the same two items in both sentences: first use «Jeg vil gjerne ha», then use «Kan jeg få».',
    },
  ],
  payload: { ...exercise.payload, min_words: null, max_words: null },
};

const sharedSurfaceExercise: WriteExercise = {
  ...unbounded,
  id: 'story-write-shared-surface',
  explanation: null,
  prompt: [
    {
      kind: 'text',
      value:
        'Write two Norwegian ordering sentences. Replace the coffee and cinnamon bun with two different café items taught in this lesson. Choose from «et rundstykke med ost», «en kopp te», and «en flaske vann». Use the same two items in both sentences: first use «Jeg vil gjerne ha», then use «Kan jeg få».',
    },
  ],
  payload: {
    ...unbounded.payload,
    criteria: [
      {
        id: 'first-order',
        instruction:
          'Uses «Jeg vil gjerne ha» in a complete order naming two different taught café items.',
      },
      {
        id: 'second-order',
        instruction:
          'Uses «Kan jeg få» in a complete order naming the same two items as the first order.',
      },
    ],
  },
};

const delay = <T,>(value: T, ms = 1600): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

const meta = {
  title: 'Flashcard/FlashCardWrite',
  component: FlashCardWrite,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div
        className="flex flex-col px-4 pt-4 pb-0"
        style={{ height: '100dvh' }}
      >
        <Story />
      </div>
    ),
  ],
  parameters: { layout: 'fullscreen' },
  args: { exercise, className: 'flex-1', desktopExpanded: true },
  argTypes: { onFinished: { action: 'onFinished' } },
} satisfies Meta<typeof FlashCardWrite>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = { args: { initialResponse: '' } };

export const UnderMinimum: Story = {
  args: { initialResponse: 'Jeg står opp klokka sju.' },
};

export const InRange: Story = {
  args: { initialResponse: sample, judgeWrite: () => delay(allMet) },
};

export const OverMaximum: Story = {
  args: {
    initialResponse: `${sample} ${sample}`,
    judgeWrite: () => delay(allMet),
  },
};

export const AllCriteriaMet: Story = {
  args: {
    initialResponse: sample,
    initialPhase: 'result',
    initialJudgement: allMet,
  },
};

export const PartiallyMet: Story = {
  args: {
    initialResponse: sample,
    initialPhase: 'result',
    initialJudgement: partial,
  },
};

export const JudgeUnavailable: Story = {
  args: { initialResponse: sample, initialPhase: 'unavailable' },
};

export const NoWordBudget: Story = {
  args: { exercise: unbounded, initialResponse: '' },
};

export const SharedSurface: Story = {
  args: { exercise: sharedSurfaceExercise, initialResponse: '' },
  parameters: {
    docs: {
      description: {
        story:
          'The selected WRITE structure: criteria and response editor stay together in one shared work surface.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const view = canvasElement.ownerDocument.defaultView;
    if (!view) throw new Error('Storybook document has no window');

    await expect(
      view.getComputedStyle(canvas.getByTestId('flashcard-footer-bar'))
        .borderTopWidth,
    ).toBe('0px');
    await expect(
      view.getComputedStyle(canvas.getByTestId('write-editor-status'))
        .borderTopWidth,
    ).toBe('0px');
  },
};

export const NoWordBudgetJudged: Story = {
  args: {
    exercise: unbounded,
    initialResponse: sample,
    initialPhase: 'result',
    initialJudgement: partial,
  },
};

export const NoWordBudgetAllMet: Story = {
  args: {
    exercise: unbounded,
    initialResponse: sample,
    initialPhase: 'result',
    initialJudgement: allMet,
  },
};

export const LongTaskInstructions: Story = {
  args: { exercise: unbounded, initialResponse: '' },
  parameters: {
    docs: {
      description: {
        story:
          'Resize the preview under 640px to see the instruction clamp and its Show full task control.',
      },
    },
  },
};

export const Checking: Story = {
  args: { initialResponse: sample, initialPhase: 'pending' },
};

export const OverCharacterLimit: Story = {
  args: { initialResponse: `${sample} ${sample} ${sample} ${sample}` },
};
