import type { Meta, StoryObj } from '@storybook/react';
import { Check, Minus } from 'lucide-react';

import type { TileVerdict } from '../answerVerdict';
import { AnswerOption } from './AnswerOption';

const states: Array<{
  state: TileVerdict;
  checked: boolean;
  marker: React.ReactNode;
}> = [
  { state: 'idle', checked: false, marker: 'A' },
  { state: 'selected', checked: true, marker: 'B' },
  { state: 'correct', checked: true, marker: <Check /> },
  { state: 'incorrect', checked: true, marker: <Minus /> },
  { state: 'revealed', checked: false, marker: 'E' },
];

function StateMatrix() {
  return (
    <div className="grid w-full max-w-3xl gap-3">
      {states.map(({ checked, marker, state }) => (
        <AnswerOption
          checked={checked}
          detail={
            state === 'correct'
              ? 'Correct for common-gender singular nouns.'
              : undefined
          }
          disabled={
            state === 'correct' || state === 'incorrect' || state === 'revealed'
          }
          key={state}
          label={`${state[0]?.toUpperCase()}${state.slice(1)} answer option`}
          marker={marker}
          state={state}
        />
      ))}
    </div>
  );
}

const meta = {
  title: 'Features/Flashcard/Answer Option',
  component: AnswerOption,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: {
    checked: false,
    label: 'Jeg leser en god bok.',
    marker: 'A',
    state: 'idle',
  },
} satisfies Meta<typeof AnswerOption>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
export const AllStates: Story = { render: () => <StateMatrix /> };

export const LongLabelsAtMobileWidth: Story = {
  render: () => (
    <div className="w-[320px] max-w-full">
      <AnswerOption
        checked
        label="Jeg blir hjemme fordi jeg ikke kan komme i dag, selv om jeg hadde gledet meg til å møte alle."
        marker="B"
        state="selected"
      />
    </div>
  ),
};

export const InlineChoices: Story = {
  render: () => (
    <div className="flex max-w-sm flex-wrap gap-2">
      <AnswerOption checked={false} label="god" layout="inline" state="idle" />
      <AnswerOption checked label="godt" layout="inline" state="selected" />
      <AnswerOption checked label="gode" layout="inline" state="correct" />
    </div>
  ),
};
