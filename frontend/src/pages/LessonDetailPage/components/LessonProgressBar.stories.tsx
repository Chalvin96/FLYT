import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';

import type { LessonPage } from '@/lib/lessonPages';
import type { Exercise, SectionPacket } from '@/types/lesson-contracts';

import { LessonProgressBar } from './LessonProgressBar';

function section(id: string, title: string): LessonPage {
  return {
    kind: 'section',
    id: `page-${id}`,
    section: {
      kind: 'section',
      id,
      role: 'orient',
      title,
      objective_ids: ['objective-1'],
      blocks: [],
    } satisfies SectionPacket,
  };
}

function exercise(id: string): LessonPage {
  return {
    kind: 'exercise',
    id: `page-${id}`,
    exerciseId: id,
    exercise: {
      kind: 'exercise',
      id,
      operation: 'choose',
      objective_id: 'objective-1',
      prompt: [],
      explanation: null,
      payload: {
        options: [
          { option_id: 'a', text: 'A' },
          { option_id: 'b', text: 'B' },
        ],
        answer_id: 'a',
      },
    } satisfies Exercise,
  };
}

const pages: LessonPage[] = [
  exercise('exercise-1'),
  section('section-1', 'Intro'),
  exercise('exercise-2'),
  section('section-2', 'Model'),
  section('section-3', 'Practice'),
  exercise('exercise-3'),
];

const meta = {
  title: 'Features/Lesson/ProgressBar',
  component: LessonProgressBar,
  parameters: { layout: 'padded' },
  args: {
    pages,
    currentIndex: 2,
    maxReachedIndex: 3,
    onGoToPage: fn(),
  },
} satisfies Meta<typeof LessonProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MixedKindsAndStates: Story = {};
