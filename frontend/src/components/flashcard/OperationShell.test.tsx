import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { Exercise } from '@/types/lesson-contracts';

import { OperationShell } from './OperationShell';
import type { ExerciseAttemptView } from './operationShellView';

const useReducedMotionMock = vi.fn(() => false);

const NON_ZERO_TRANSLATE = /translate3d\(-?[^0]/;

vi.mock('motion/react', async () => {
  const actual =
    await vi.importActual<typeof import('motion/react')>('motion/react');
  return {
    ...actual,
    useReducedMotion: () => useReducedMotionMock(),
  };
});

type ChooseExercise = Extract<Exercise, { operation: 'choose' }>;

function makeExercise(): ChooseExercise {
  return {
    kind: 'exercise',
    objective_id: 'obj-1',
    id: 'ex-1',
    operation: 'choose',
    prompt: [{ kind: 'text', value: 'Pick one.' }],
    explanation: [{ kind: 'text', value: 'Because grammar.' }],
    payload: {
      options: [
        { option_id: 'a', text: 'A' },
        { option_id: 'b', text: 'B' },
      ],
      answer_id: 'a',
    },
  };
}

function Shell({
  attempt = { kind: 'single', result: null },
  canCheck = true,
  statusHint,
  pending = false,
  pendingLabel,
  exercise = makeExercise(),
  onCheck = vi.fn(),
  onContinue = vi.fn(),
  children = <p data-testid="body">Body</p>,
}: {
  attempt?: ExerciseAttemptView;
  canCheck?: boolean;
  statusHint?: string;
  pending?: boolean;
  pendingLabel?: string;
  exercise?: Exercise;
  onCheck?: () => void;
  onContinue?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <OperationShell
      attempt={attempt}
      exercise={exercise}
      canCheck={canCheck}
      statusHint={statusHint}
      pending={pending}
      pendingLabel={pendingLabel}
      onCheck={onCheck}
      onContinue={onContinue}
    >
      {children}
    </OperationShell>
  );
}

describe('OperationShell — non-retry path', () => {
  it('renders a Check button that calls onCheck when canCheck is true', async () => {
    const user = userEvent.setup();
    const onCheck = vi.fn();
    render(<Shell onCheck={onCheck} canCheck />);

    const checkButton = screen.getByRole('button', { name: /check/i });
    expect(checkButton).not.toBeDisabled();
    await user.click(checkButton);
    expect(onCheck).toHaveBeenCalledTimes(1);
  });

  it('disables Check when canCheck is false', () => {
    render(<Shell canCheck={false} />);
    expect(screen.getByRole('button', { name: /check/i })).toBeDisabled();
  });

  it('renders Continue and calls onContinue after a result is set (correct)', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(
      <Shell
        attempt={{ kind: 'single', result: { correct: true } }}
        onContinue={onContinue}
      />,
    );

    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/^correct$/i)).toBeInTheDocument();
  });

  it('renders the wrong banner text when result is incorrect', () => {
    render(<Shell attempt={{ kind: 'single', result: { correct: false } }} />);
    expect(screen.getByText(/not quite/i)).toBeInTheDocument();
  });

  it('never renders a button whose label/onClick flips between Check and Continue', () => {
    const { rerender } = render(<Shell canCheck />);

    expect(screen.getByRole('button', { name: /check/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /continue/i }),
    ).not.toBeInTheDocument();

    rerender(
      <Shell
        attempt={{ kind: 'single', result: { correct: true } }}
        canCheck
      />,
    );

    expect(
      screen.getByRole('button', { name: /continue/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /check/i }),
    ).not.toBeInTheDocument();
  });
});

describe('OperationShell — retry path', () => {
  describe('footer (working / wrong)', () => {
    it('shows Check (disabled when canCheck=false) with no Reveal button in working phase', () => {
      render(
        <Shell
          attempt={{
            kind: 'retry',
            result: null,
            phase: 'working',
            shakeKey: 0,
            canReveal: false,
            onReveal: vi.fn(),
          }}
          canCheck={false}
        />,
      );

      expect(screen.getByRole('button', { name: /check/i })).toBeDisabled();
      expect(
        screen.queryByRole('button', { name: /reveal answer/i }),
      ).not.toBeInTheDocument();
    });

    it('shows Check (enabled) when canCheck is true', () => {
      render(
        <Shell
          attempt={{
            kind: 'retry',
            result: null,
            phase: 'working',
            shakeKey: 0,
            canReveal: false,
            onReveal: vi.fn(),
          }}
          canCheck
        />,
      );
      expect(screen.getByRole('button', { name: /check/i })).not.toBeDisabled();
    });

    it('shows "Adjust your answer to try again." in wrong phase with canCheck=false', () => {
      render(
        <Shell
          attempt={{
            kind: 'retry',
            result: null,
            phase: 'wrong',
            shakeKey: 1,
            canReveal: false,
            onReveal: vi.fn(),
          }}
          canCheck={false}
        />,
      );
      expect(screen.getByTestId('flashcard-action-status')).toHaveTextContent(
        /adjust your answer to try again\./i,
      );
    });

    it('shows "Ready to check" in working phase with canCheck=true', () => {
      render(
        <Shell
          attempt={{
            kind: 'retry',
            result: null,
            phase: 'working',
            shakeKey: 0,
            canReveal: false,
            onReveal: vi.fn(),
          }}
          canCheck
        />,
      );
      expect(screen.getByTestId('flashcard-action-status')).toHaveTextContent(
        /ready to check/i,
      );
    });

    it('shows Reveal answer button only when canReveal is true', () => {
      const onReveal = vi.fn();
      render(
        <Shell
          attempt={{
            kind: 'retry',
            result: null,
            phase: 'wrong',
            shakeKey: 1,
            canReveal: true,
            onReveal,
          }}
          canCheck
        />,
      );
      expect(
        screen.getByRole('button', { name: /reveal answer/i }),
      ).toBeInTheDocument();
    });

    it('calls onReveal when Reveal answer is clicked', async () => {
      const user = userEvent.setup();
      const onReveal = vi.fn();
      render(
        <Shell
          attempt={{
            kind: 'retry',
            result: null,
            phase: 'wrong',
            shakeKey: 1,
            canReveal: true,
            onReveal,
          }}
          canCheck
        />,
      );
      await user.click(screen.getByRole('button', { name: /reveal answer/i }));
      expect(onReveal).toHaveBeenCalledTimes(1);
    });

    it('does not render the wrongHint in retry mode', () => {
      render(
        <OperationShell
          exercise={makeExercise()}
          attempt={{
            kind: 'retry',
            result: null,
            phase: 'wrong',
            shakeKey: 1,
            canReveal: false,
            onReveal: vi.fn(),
          }}
          wrongHint="Old hint text"
          onCheck={vi.fn()}
        >
          <p>Body</p>
        </OperationShell>,
      );
      expect(screen.queryByText('Old hint text')).not.toBeInTheDocument();
    });
  });

  describe('banner states', () => {
    it('shows exactly one alert (sr-only live region) in wrong phase; visible banner has no role', () => {
      render(
        <Shell
          attempt={{
            kind: 'retry',
            result: null,
            phase: 'wrong',
            shakeKey: 1,
            canReveal: false,
            onReveal: vi.fn(),
          }}
        />,
      );
      const alerts = screen.getAllByRole('alert');
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toHaveClass('sr-only');
      expect(alerts[0]).toHaveTextContent(
        /incorrect — adjust your answer and try again./i,
      );

      const visibleBanner = screen
        .getAllByText(/incorrect — adjust your answer and try again./i)
        .find((el) => !el.hasAttribute('role'));
      expect(visibleBanner).toBeDefined();
      expect(visibleBanner).not.toHaveAttribute('role');
      expect(visibleBanner).not.toHaveAttribute('aria-live');
    });

    it('does not show an alert in the working phase', () => {
      render(
        <Shell
          attempt={{
            kind: 'retry',
            result: null,
            phase: 'working',
            shakeKey: 0,
            canReveal: false,
            onReveal: vi.fn(),
          }}
        />,
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('footer (solved / revealed)', () => {
    it('shows Continue in solved phase and calls onContinue', async () => {
      const user = userEvent.setup();
      const onContinue = vi.fn();
      render(
        <Shell
          attempt={{
            kind: 'retry',
            result: null,
            phase: 'solved',
            shakeKey: 0,
            canReveal: false,
            onReveal: vi.fn(),
          }}
          onContinue={onContinue}
        />,
      );
      const continueButton = screen.getByRole('button', { name: /continue/i });
      expect(continueButton).toBeInTheDocument();
      await user.click(continueButton);
      expect(onContinue).toHaveBeenCalledTimes(1);
    });

    it('shows the solved "Correct" banner in solved phase', () => {
      render(
        <Shell
          attempt={{
            kind: 'retry',
            result: null,
            phase: 'solved',
            shakeKey: 0,
            canReveal: false,
            onReveal: vi.fn(),
          }}
        />,
      );
      expect(screen.getByText(/^correct$/i)).toBeInTheDocument();
      expect(screen.getByText('Because grammar.')).toBeInTheDocument();
    });

    it('shows Continue in revealed phase and the revealed banner', () => {
      render(
        <Shell
          attempt={{
            kind: 'retry',
            result: null,
            phase: 'revealed',
            shakeKey: 1,
            canReveal: false,
            onReveal: vi.fn(),
          }}
        />,
      );
      expect(
        screen.getByRole('button', { name: /continue/i }),
      ).toBeInTheDocument();
      expect(screen.getByText(/here's the answer\./i)).toBeInTheDocument();
    });

    it('does not render Reveal answer in terminal phases', () => {
      render(
        <Shell
          attempt={{
            kind: 'retry',
            result: null,
            phase: 'revealed',
            shakeKey: 1,
            canReveal: true,
            onReveal: vi.fn(),
          }}
        />,
      );
      expect(
        screen.queryByRole('button', { name: /reveal answer/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe('focus management', () => {
    it('moves focus to Continue when entering a terminal phase', () => {
      render(
        <Shell
          attempt={{
            kind: 'retry',
            result: null,
            phase: 'solved',
            shakeKey: 0,
            canReveal: false,
            onReveal: vi.fn(),
          }}
        />,
      );
      expect(screen.getByRole('button', { name: /continue/i })).toHaveFocus();
    });

    it('does not steal focus in the working phase', () => {
      render(
        <Shell
          attempt={{
            kind: 'retry',
            result: null,
            phase: 'working',
            shakeKey: 0,
            canReveal: false,
            onReveal: vi.fn(),
          }}
        />,
      );
      expect(screen.getByRole('button', { name: /check/i })).not.toHaveFocus();
    });
  });

  describe('reduced motion', () => {
    it('renders the wrong-phase alert without shake when reduced motion is preferred', () => {
      useReducedMotionMock.mockReturnValue(true);
      try {
        render(
          <Shell
            attempt={{
              kind: 'retry',
              result: null,
              phase: 'wrong',
              shakeKey: 1,
              canReveal: false,
              onReveal: vi.fn(),
            }}
          />,
        );

        const alerts = screen.getAllByRole('alert');
        expect(alerts).toHaveLength(1);
        expect(alerts[0]).toHaveClass('sr-only');
        expect(alerts[0]).toHaveTextContent(
          /incorrect — adjust your answer and try again./i,
        );

        const visibleBanner = screen
          .getAllByText(/incorrect — adjust your answer and try again./i)
          .find((el) => !el.hasAttribute('role'));
        expect(visibleBanner).toBeDefined();
        const wrapper = screen.getByTestId('work-surface');
        expect(wrapper).toBeInTheDocument();
        const style = wrapper.getAttribute('style') ?? '';
        expect(style).not.toMatch(NON_ZERO_TRANSLATE);
      } finally {
        useReducedMotionMock.mockReturnValue(false);
      }
    });

    it('renders the wrong-phase alert with shake when motion is allowed', () => {
      useReducedMotionMock.mockReturnValue(false);
      render(
        <Shell
          attempt={{
            kind: 'retry',
            result: null,
            phase: 'wrong',
            shakeKey: 1,
            canReveal: false,
            onReveal: vi.fn(),
          }}
        />,
      );

      const alerts = screen.getAllByRole('alert');
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toHaveClass('sr-only');
      expect(alerts[0]).toHaveTextContent(
        /incorrect — adjust your answer and try again./i,
      );
    });

    it('preserves keyboard focus inside the work surface across wrong checks for reduced-motion users', () => {
      useReducedMotionMock.mockReturnValue(true);
      try {
        function ShellWithFocusable({ shakeKey }: { shakeKey: number }) {
          return (
            <OperationShell
              exercise={makeExercise()}
              attempt={{
                kind: 'retry',
                result: null,
                phase: 'wrong',
                shakeKey,
                canReveal: false,
                onReveal: vi.fn(),
              }}
              onCheck={vi.fn()}
            >
              <button type="button">Focusable child</button>
            </OperationShell>
          );
        }

        const { rerender } = render(<ShellWithFocusable shakeKey={1} />);
        const child = screen.getByRole('button', {
          name: /focusable child/i,
        });
        child.focus();
        expect(child).toHaveFocus();

        rerender(<ShellWithFocusable shakeKey={2} />);
        expect(child).toHaveFocus();
      } finally {
        useReducedMotionMock.mockReturnValue(false);
      }
    });

    it('test_work_surface_given_repeated_wrong_check_expect_focus_preserved', () => {
      useReducedMotionMock.mockReturnValue(false);
      try {
        function ShellWithFocusable({ shakeKey }: { shakeKey: number }) {
          return (
            <OperationShell
              exercise={makeExercise()}
              attempt={{
                kind: 'retry',
                result: null,
                phase: 'wrong',
                shakeKey,
                canReveal: false,
                onReveal: vi.fn(),
              }}
              onCheck={vi.fn()}
            >
              <button type="button">Focusable child</button>
            </OperationShell>
          );
        }

        const { rerender } = render(<ShellWithFocusable shakeKey={1} />);
        const child = screen.getByRole('button', {
          name: /focusable child/i,
        });
        child.focus();
        expect(child).toHaveFocus();

        rerender(<ShellWithFocusable shakeKey={2} />);
        expect(child).toHaveFocus();
      } finally {
        useReducedMotionMock.mockReturnValue(false);
      }
    });
  });
});

describe('OperationShell — shared exercise UI normalization', () => {
  it('test_work_surface_given_default_expect_top_aligned_on_phones_with_reserved_banner_slot', () => {
    render(<Shell />);

    const surface = screen.getByTestId('work-surface');
    const reservedSlot = within(surface).getByTestId('operation-banner');

    expect(reservedSlot).toHaveAttribute('aria-hidden', 'true');
  });

  it('test_pending_check_given_render_expect_disabled_button_and_live_status', () => {
    render(<Shell pending pendingLabel="Checking answer…" />);

    const pendingButton = screen.getByRole('button', {
      name: 'Checking answer…',
    });

    expect(pendingButton).toBeDisabled();
    expect(screen.getByTestId('flashcard-action-status')).toHaveTextContent(
      'Checking answer…',
    );
    expect(screen.getByTestId('flashcard-action-status')).toHaveAttribute(
      'aria-live',
      'polite',
    );
  });

  it('test_shared_banner_given_correct_result_expect_subtle_accent_treatment', () => {
    render(<Shell attempt={{ kind: 'single', result: { correct: true } }} />);

    const banner = screen.getByText(/^correct$/i);
    expect(banner).toBeInTheDocument();
    expect(screen.getByTestId('operation-banner')).toHaveAttribute(
      'role',
      'status',
    );
    expect(screen.getByTestId('flashcard-action-status')).not.toHaveAttribute(
      'aria-live',
    );
  });

  it('test_shared_banner_given_incorrect_result_expect_subtle_destructive_treatment', () => {
    render(<Shell attempt={{ kind: 'single', result: { correct: false } }} />);

    const banner = screen.getByText(/not quite/i);
    expect(banner).toBeInTheDocument();
    expect(screen.getByTestId('operation-banner')).toHaveAttribute(
      'role',
      'status',
    );
  });
});

describe('OperationShell — dialogue stimulus', () => {
  function withDialogueStimulus(): ChooseExercise {
    return {
      ...makeExercise(),
      stimulus: [
        {
          kind: 'dialogue',
          turns: [
            {
              speaker: 'Mina',
              text: [{ kind: 'text', value: '«Du skulle ha kjøpt brød.»' }],
            },
          ],
        },
      ],
    };
  }

  it('test_operation_shell_given_dialogue_stimulus_expect_rendered_before_prompt', () => {
    render(<Shell exercise={withDialogueStimulus()} />);

    const stimulus = screen.getByTestId('exercise-stimulus');
    const prompt = screen.getByTestId('exercise-prompt');
    expect(stimulus).toHaveTextContent('Mina');
    expect(
      stimulus.compareDocumentPosition(prompt) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('test_operation_shell_given_omitted_stimulus_expect_no_stimulus_region', () => {
    render(<Shell />);

    expect(screen.queryByTestId('exercise-stimulus')).not.toBeInTheDocument();
    expect(screen.getByTestId('exercise-prompt')).toHaveTextContent(
      'Pick one.',
    );
  });
});
