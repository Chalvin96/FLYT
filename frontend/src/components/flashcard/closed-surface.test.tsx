import { render, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';

import type { Exercise } from '@/types/lesson-contracts';

import { FlashCardFrame } from './FlashCardFrame';
import { OperationShell } from './OperationShell';
import { TokenBoard } from './TokenBoard/TokenBoard';

type ChooseExercise = Extract<Exercise, { operation: 'choose' }>;

const exercise: ChooseExercise = {
  kind: 'exercise',
  objective_id: 'objective-1',
  id: 'exercise-1',
  operation: 'choose',
  prompt: [{ kind: 'text', value: 'Pick one.' }],
  explanation: [],
  payload: {
    options: [
      { option_id: 'a', text: 'A' },
      { option_id: 'b', text: 'B' },
    ],
    answer_id: 'a',
  },
};

const injectedClassName = { className: 'INJECTED' } as ComponentProps<'div'>;
const injectedStyle = {
  style: { color: 'red' },
} as ComponentProps<'div'>;

function renderClosedSurfaces(injectedProps: ComponentProps<'div'>) {
  return render(
    <>
      <FlashCardFrame {...injectedProps} data-testid="closed-flash-card-frame">
        Frame
      </FlashCardFrame>
      <OperationShell
        {...injectedProps}
        attempt={{ kind: 'single', result: null }}
        data-testid="closed-operation-shell"
        exercise={exercise}
        onCheck={vi.fn()}
      >
        Operation
      </OperationShell>
      <TokenBoard
        {...injectedProps}
        data-testid="closed-token-board"
        tokens={[]}
        answerOrder={[]}
        selectedTokenIds={[]}
        onAdd={vi.fn()}
        onMoveToSlot={vi.fn()}
        onRemove={vi.fn()}
      />
    </>,
  );
}

function attributeSet(element: Element): string[] {
  return Array.from(element.attributes)
    .map(({ name, value }) => `${name}="${value}"`)
    .sort();
}

function expectSurfaceUnchangedByInjectedProps(
  testId: string,
  injectedProps: ComponentProps<'div'>,
) {
  const { container: injectedContainer } = renderClosedSurfaces(injectedProps);
  const withInjectedProps = within(injectedContainer).getByTestId(testId);
  const { container: plainContainer } = renderClosedSurfaces({});
  const plainSurface = within(plainContainer).getByTestId(testId);

  // A spread that carries `class` lands it before the attributes written after
  // it, so the root's attribute order shifts while the surface does not.
  expect(attributeSet(withInjectedProps)).toEqual(attributeSet(plainSurface));
  expect(withInjectedProps.innerHTML).toBe(plainSurface.innerHTML);
}

const SURFACES = [
  'closed-flash-card-frame',
  'closed-operation-shell',
  'closed-token-board',
];

describe('flashcard closed surfaces', () => {
  it.each(SURFACES)(
    'test_closed_surface_given_cast_and_spread_expect_injected_class_rejected',
    (testId) => {
      expectSurfaceUnchangedByInjectedProps(testId, injectedClassName);
    },
  );

  it.each(SURFACES)(
    'test_closed_surface_given_cast_and_spread_expect_inline_style_rejected',
    (testId) => {
      expectSurfaceUnchangedByInjectedProps(testId, injectedStyle);
    },
  );
});
